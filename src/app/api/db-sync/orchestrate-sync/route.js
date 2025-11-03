import { NextResponse } from "next/server";
import { cookies } from 'next/headers';

/**
 * Orchestrator API: Coordinates distributed database synchronization
 * Manages communication between source and target agents with batching
 *
 * Features:
 * - Agent-based or direct database connections
 * - Batch processing (5000 rows per batch)
 * - Concurrent table sync (3 tables at a time)
 * - Progress tracking
 * - Error recovery
 */

const BATCH_SIZE = 5000;
const CONCURRENT_TABLES = 3;

/**
 * Helper: Make authenticated request to agent
 */
async function agentRequest(agentUrl, endpoint, body) {
  const cookieStore = cookies();
  const authToken = cookieStore.get('authToken')?.value;

  if (!authToken) {
    throw new Error('Authentication required');
  }

  const url = `${agentUrl}${endpoint}`;
  console.log(`🔗 Agent Request: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `authToken=${authToken}`
    },
    body: JSON.stringify(body),
    credentials: 'include' // Important: include cookies in cross-origin requests
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `Agent request failed: ${response.status}`);
  }

  return await response.json();
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

    // Step 4: Fetch and sync in batches
    console.log(`\n[4/5] Syncing data in batches...`);

    while (hasMore) {
      // Fetch batch from source
      const dataResult = await agentRequest(
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

      if (!dataResult.success) {
        throw new Error(`Failed to fetch data: ${dataResult.message}`);
      }

      const batchData = dataResult.data;
      totalCount = dataResult.totalCount;
      hasMore = dataResult.hasMore;
      const nextOffset = dataResult.nextOffset;
      const totalBatches = dataResult.totalBatches;

      console.log(`\n  Batch ${batchNumber}/${totalBatches}: ${batchData.length} rows`);

      // If no data, we're done
      if (batchData.length === 0) {
        break;
      }

      // Send batch to target
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
      console.log(`  ✓ Synced: +${syncResult.inserted} ~${syncResult.updated}`);

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
