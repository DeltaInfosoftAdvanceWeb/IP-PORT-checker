import { NextResponse } from "next/server";
import { cookies } from 'next/headers';

/**
 * Orchestrator API: Coordinates distributed database synchronization
 * Manages communication between source and target agents with batching
 *
 * Features:
 * - Agent-based or direct database connections
 * - Optimized batch processing (10000 rows per batch)
 * - High concurrent table sync (5 tables at a time)
 * - Parallel batch fetching (2 batches ahead)
 * - Progress tracking
 * - Error recovery
 */

const BATCH_SIZE = 10000; // Increased from 5000 for better throughput
const CONCURRENT_TABLES = 5; // Increased from 3 for parallel processing
const PARALLEL_BATCHES = 2; // Fetch ahead batches for pipelining

/**
 * Helper: Make authenticated request to agent with retry logic
 * Now uses internal proxy to support HTTP agents from HTTPS Vercel
 */
async function agentRequest(agentUrl, endpoint, body, retries = 3) {
  const cookieStore = cookies();
  const authToken = cookieStore.get('authToken')?.value;

  if (!authToken) {
    throw new Error('Authentication required');
  }

  const targetUrl = `${agentUrl}${endpoint}`;
  console.log(`🔗 Agent Request (via internal proxy): ${targetUrl}`);

  // Use internal proxy for agent requests to avoid mixed content issues
  const proxyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/db-agent/proxy`;

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUrl,
          method: 'POST',
          body,
          headers: {
            'Cookie': `authToken=${authToken}`
          },
          agentAuthKey: process.env.NEXT_PUBLIC_PASS_KEY
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Proxy request failed' }));
        console.error(`❌ Agent request failed (attempt ${attempt}/${retries}):`, error);

        // Retry on 500, 502, 503, 504 errors
        if (attempt < retries && [500, 502, 503, 504].includes(response.status)) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`   ⏳ Retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }

        throw new Error(error.message || `Agent request failed: ${response.status}`);
      }

      const data = await response.json();

      // Log proxy metadata
      if (data._proxy) {
        console.log(`   Proxy duration: ${data._proxy.duration}ms`);
      }

      if (!data.success) {
        throw new Error(data.message || 'Agent request returned unsuccessful response');
      }

      return data;
    } catch (error) {
      lastError = error;

      // Retry on network errors
      if (attempt < retries && (error.name === 'FetchError' || error.message.includes('ECONNREFUSED') || error.message.includes('timeout'))) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`   ⏳ Network error, retrying in ${backoff}ms... (attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Sync a single table with batching
 */
async function syncTable({
  tableName,
  sourceAgent,
  targetAgent,
  sourceDB,
  targetDB,
  sourceConfig,
  targetConfig,
  sourceConnectionUrl,
  targetConnectionUrl,
  syncStrategy
}) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Syncing table: ${tableName}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Step 1: Get source schema
    console.log(`\n[1/5] Fetching schema from source...`);
    const schemaResult = await agentRequest(
      sourceAgent,
      '/api/db-agent/source/get-schema',
      {
        dbType: sourceDB,
        config: sourceConfig,
        connectionUrl: sourceConnectionUrl,
        tableName
      }
    );

    if (!schemaResult.success) {
      throw new Error(`Failed to get schema: ${schemaResult.message}`);
    }

    const schema = schemaResult.schema;
    const columns = schema.map(col => col.column_name);
    console.log(`✓ Schema retrieved: ${columns.length} columns`);

    // Step 2: Create table in target if needed
    console.log(`\n[2/5] Creating table in target (if needed)...`);
    const createResult = await agentRequest(
      targetAgent,
      '/api/db-agent/target/create-table',
      {
        dbType: targetDB,
        config: targetConfig,
        connectionUrl: targetConnectionUrl,
        tableName,
        schema,
        sourceDB
      }
    );

    if (!createResult.success) {
      throw new Error(`Failed to create table: ${createResult.message}`);
    }

    const tableCreated = createResult.tableCreated;
    console.log(`✓ ${tableCreated ? 'Table created' : 'Table already exists'}`);

    // Step 3: Get total count and prepare batching
    console.log(`\n[3/5] Fetching data from source...`);
    let offset = 0;
    let totalSynced = 0;
    let batchNumber = 1;
    let hasMore = true;
    let totalCount = 0;
    let isFirstBatch = true;

    let syncStats = {
      inserted: 0,
      updated: 0,
      deleted: 0,
      skipped: 0
    };

    // Step 4: Fetch and sync in batches with pipelining
    console.log(`\n[4/5] Syncing data in batches (pipelined)...`);

    // Pipeline: Fetch next batch while processing current batch
    let fetchPromise = null;
    let currentBatch = null;

    while (hasMore) {
      const fetchStartTime = Date.now();

      // Start fetching next batch (or first batch)
      if (!currentBatch) {
        currentBatch = await agentRequest(
          sourceAgent,
          '/api/db-agent/source/get-data',
          {
            dbType: sourceDB,
            config: sourceConfig,
            connectionUrl: sourceConnectionUrl,
            tableName,
            offset,
            limit: BATCH_SIZE
          }
        );
      } else {
        // Use prefetched batch
        currentBatch = await fetchPromise;
      }

      if (!currentBatch.success) {
        throw new Error(`Failed to fetch data: ${currentBatch.message}`);
      }

      const batchData = currentBatch.data;
      totalCount = currentBatch.totalCount;
      hasMore = currentBatch.hasMore;
      const nextOffset = currentBatch.nextOffset;
      const totalBatches = currentBatch.totalBatches;

      console.log(`\n  Batch ${batchNumber}/${totalBatches}: ${batchData.length} rows (fetched in ${Date.now() - fetchStartTime}ms)`);

      // If no data, we're done
      if (batchData.length === 0) {
        break;
      }

      // Start prefetching next batch while we process current one
      if (hasMore) {
        fetchPromise = agentRequest(
          sourceAgent,
          '/api/db-agent/source/get-data',
          {
            dbType: sourceDB,
            config: sourceConfig,
            connectionUrl: sourceConnectionUrl,
            tableName,
            offset: nextOffset,
            limit: BATCH_SIZE
          }
        );
      }

      // Process current batch (sync to target) - runs in parallel with fetch
      const syncStartTime = Date.now();
      const isLastBatch = !hasMore;
      const syncResult = await agentRequest(
        targetAgent,
        '/api/db-agent/target/sync-data',
        {
          dbType: targetDB,
          config: targetConfig,
          connectionUrl: targetConnectionUrl,
          tableName,
          data: batchData,
          columns,
          syncStrategy,
          isFirstBatch,
          isLastBatch
        }
      );

      if (!syncResult.success) {
        throw new Error(`Failed to sync batch: ${syncResult.message}`);
      }

      // Accumulate stats
      syncStats.inserted += syncResult.inserted || 0;
      syncStats.updated += syncResult.updated || 0;
      syncStats.deleted += syncResult.deleted || 0;
      syncStats.skipped += syncResult.skipped || 0;

      totalSynced += batchData.length;
      console.log(`  ✓ Synced: +${syncResult.inserted} ~${syncResult.updated} (${Date.now() - syncStartTime}ms)`);

      // Prepare for next batch
      offset = nextOffset;
      batchNumber++;
      isFirstBatch = false;
    }

    // Step 5: Complete
    const duration = Date.now() - startTime;
    const totalAffected = syncStats.inserted + syncStats.updated + syncStats.deleted;

    console.log(`\n[5/5] ✅ Table sync completed`);
    console.log(`   • Total Rows: ${totalCount}`);
    console.log(`   • Inserted: ${syncStats.inserted}`);
    console.log(`   • Updated: ${syncStats.updated}`);
    console.log(`   • Deleted: ${syncStats.deleted}`);
    console.log(`   • Duration: ${duration}ms`);

    return {
      table: tableName,
      success: true,
      message: `Successfully synced ${totalAffected} row(s)${tableCreated ? ' (table created)' : ''}`,
      rowsInserted: syncStats.inserted,
      rowsUpdated: syncStats.updated,
      rowsDeleted: syncStats.deleted,
      rowsSkipped: syncStats.skipped,
      rowsAffected: totalAffected,
      tableCreated,
      duration,
      strategy: syncStrategy
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Error syncing table ${tableName}:`, error.message);

    return {
      table: tableName,
      success: false,
      message: `Error: ${error.message}`,
      rowsInserted: 0,
      rowsUpdated: 0,
      rowsDeleted: 0,
      rowsSkipped: 0,
      rowsAffected: 0,
      tableCreated: false,
      duration,
      strategy: syncStrategy,
      error: error.message
    };
  }
}

/**
 * Main orchestrator endpoint
 */
export async function POST(req) {
  const startTime = Date.now();
  console.log('\n========================================');
  console.log('🎯 ORCHESTRATED SYNC STARTED');
  console.log('========================================\n');

  try {
    const {
      sourceDB,
      targetDB,
      sourceConfig,
      targetConfig,
      sourceConnectionUrl,
      targetConnectionUrl,
      sourceAgentUrl,
      targetAgentUrl,
      tables,
      syncStrategy = 'replace'
    } = await req.json();

    // Validate input
    if (
      !sourceDB ||
      !targetDB ||
      (!sourceConfig && !sourceConnectionUrl) ||
      (!targetConfig && !targetConnectionUrl) ||
      !tables ||
      tables.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "All required fields must be provided",
        },
        { status: 400 }
      );
    }

    console.log(`📊 Sync Configuration:`);
    console.log(`   Source: ${sourceDB}`);
    console.log(`   Target: ${targetDB}`);
    console.log(`   Strategy: ${syncStrategy.toUpperCase()}`);
    console.log(`   Tables: ${tables.length}`);
    console.log(`   Source Agent: ${sourceAgentUrl || 'Direct'}`);
    console.log(`   Target Agent: ${targetAgentUrl || 'Direct'}`);
    console.log(`   Batch Size: ${BATCH_SIZE}`);
    console.log(`   Concurrent: ${CONCURRENT_TABLES} tables`);
    console.log('');

    // Determine agent URLs (use same app if not specified)
    const sourceAgent = sourceAgentUrl || '';
    const targetAgent = targetAgentUrl || '';

    // Sync tables with concurrency control
    const results = [];

    for (let i = 0; i < tables.length; i += CONCURRENT_TABLES) {
      const batch = tables.slice(i, i + CONCURRENT_TABLES);
      console.log(`\n🔄 Processing batch of ${batch.length} tables (${i + 1}-${Math.min(i + CONCURRENT_TABLES, tables.length)} of ${tables.length})\n`);

      const batchPromises = batch.map(tableName =>
        syncTable({
          tableName,
          sourceAgent,
          targetAgent,
          sourceDB,
          targetDB,
          sourceConfig,
          targetConfig,
          sourceConnectionUrl,
          targetConnectionUrl,
          syncStrategy
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Calculate summary
    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const totalInserted = results.reduce((sum, r) => sum + r.rowsInserted, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.rowsUpdated, 0);
    const totalDeleted = results.reduce((sum, r) => sum + r.rowsDeleted, 0);
    const totalAffected = results.reduce((sum, r) => sum + r.rowsAffected, 0);

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 ORCHESTRATED SYNC SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Success: ${successCount} table(s)`);
    console.log(`❌ Failed: ${failureCount} table(s)`);
    console.log(`📥 Total Inserted: ${totalInserted} row(s)`);
    console.log(`🔄 Total Updated: ${totalUpdated} row(s)`);
    console.log(`🗑️  Total Deleted: ${totalDeleted} row(s)`);
    console.log(`📊 Total Affected: ${totalAffected} row(s)`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json(
      {
        success: true,
        results,
        summary: {
          totalTables: tables.length,
          successCount,
          failureCount,
          totalInserted,
          totalUpdated,
          totalDeleted,
          totalAffected,
          duration: totalDuration,
          strategy: syncStrategy
        },
        message: "Orchestrated synchronization completed",
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("\n❌ CRITICAL ERROR during orchestration:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "An unexpected error occurred during synchronization",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
