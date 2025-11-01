import { NextResponse } from "next/server";
import {
  getPostgresSchema,
  getMssqlSchema,
  getPostgresPrimaryKey,
  getMssqlPrimaryKey,
  postgresTableExists,
  mssqlTableExists,
  createPostgresTable,
  createMssqlTable,
} from "../helpers/dbHelpers.js";
import { executeSyncStrategy } from "../helpers/syncStrategies.js";

/**
 * Production-grade cross-database synchronization API
 * Supports PostgreSQL ⇄ MSSQL with transactional safety
 * 
 * Features:
 * - Two sync strategies: 'replace' (full refresh) and 'merge' (upsert)
 * - Automatic primary key detection
 * - Transaction support with rollback on failure
 * - Detailed sync statistics per table
 * - Efficient bulk operations
 */
export async function POST(req) {
  const startTime = Date.now();
  let sourceClient = null;
  let targetClient = null;
  let sourcePool = null;
  let targetPool = null;

  console.log('\n========================================');
  console.log('🔄 DATABASE SYNC OPERATION STARTED');
  console.log('========================================\n');

  try {
    const {
      sourceDB,
      targetDB,
      sourceConfig,
      targetConfig,
      sourceConnectionUrl,
      targetConnectionUrl,
      tables,
      syncStrategy = 'replace' // Default to 'replace' strategy
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
          message: "All fields are required (sourceDB, targetDB, config, tables)",
        },
        { status: 400 }
      );
    }

    // Validate sync strategy
    if (!['replace', 'merge'].includes(syncStrategy)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sync strategy. Must be 'replace' or 'merge'",
        },
        { status: 400 }
      );
    }

    console.log(`📊 Sync Configuration:`);
    console.log(`   Source: ${sourceDB} (${sourceConfig?.database || 'from URL'})`);
    console.log(`   Target: ${targetDB} (${targetConfig?.database || 'from URL'})`);
    console.log(`   Strategy: ${syncStrategy.toUpperCase()}`);
    console.log(`   Tables: ${tables.length}`);
    console.log('');

    const results = [];

    // ========================================
    // STEP 1: Establish Source Connection
    // ========================================
    console.log('📡 Connecting to source database...');
    if (sourceDB === "postgresql") {
      const { Client } = require("pg");
      sourceClient = sourceConnectionUrl
        ? new Client({ connectionString: sourceConnectionUrl, connectionTimeoutMillis: 10000 })
        : new Client({
            host: sourceConfig.host,
            port: parseInt(sourceConfig.port),
            database: sourceConfig.database,
            user: sourceConfig.username,
            password: sourceConfig.password,
            connectionTimeoutMillis: 10000,
          });
      await sourceClient.connect();
      console.log(`✅ Connected to PostgreSQL source: ${sourceConfig?.database || 'from URL'}\n`);
    } else if (sourceDB === "mssql") {
      const sql = require("mssql");
      const sqlConfig = sourceConnectionUrl
        ? sourceConnectionUrl
        : {
            user: sourceConfig.username,
            password: sourceConfig.password,
            server: sourceConfig.host,
            port: parseInt(sourceConfig.port),
            database: sourceConfig.database,
            options: { 
              encrypt: true, 
              trustServerCertificate: true, 
              connectionTimeout: 10000,
              pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
              }
            },
          };
      sourcePool = await sql.connect(sqlConfig);
      const verifySource = await sourcePool.request().query('SELECT DB_NAME() AS current_db');
      console.log(`✅ Connected to MSSQL source: ${verifySource.recordset[0].current_db}\n`);
    }

    // ========================================
    // STEP 2: Establish Target Connection
    // ========================================
    console.log('📡 Connecting to target database...');
    if (targetDB === "postgresql") {
      const { Client } = require("pg");
      targetClient = targetConnectionUrl
        ? new Client({ connectionString: targetConnectionUrl, connectionTimeoutMillis: 10000 })
        : new Client({
            host: targetConfig.host,
            port: parseInt(targetConfig.port),
            database: targetConfig.database,
            user: targetConfig.username,
            password: targetConfig.password,
            connectionTimeoutMillis: 10000,
          });
      await targetClient.connect();
      console.log(`✅ Connected to PostgreSQL target: ${targetConfig?.database || 'from URL'}\n`);
    } else if (targetDB === "mssql") {
      const sql = require("mssql");
      
      // Create a new connection pool for target (separate from source)
      const sqlConfig = targetConnectionUrl
        ? targetConnectionUrl
        : {
            user: targetConfig.username,
            password: targetConfig.password,
            server: targetConfig.host,
            port: parseInt(targetConfig.port),
            database: targetConfig.database,
            options: { 
              encrypt: true, 
              trustServerCertificate: true, 
              connectionTimeout: 10000,
              enableArithAbort: true,
              pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
              }
            },
          };
      
      // For MSSQL to MSSQL on same server, create a new Pool instance
      if (sourceDB === "mssql" && sourcePool) {
        const { ConnectionPool } = require("mssql");
        targetPool = new ConnectionPool(sqlConfig);
        await targetPool.connect();
        console.log(`✅ Created separate MSSQL connection pool for target`);
      } else {
        targetPool = await sql.connect(sqlConfig);
      }
      
      const verifyQuery = await targetPool.request().query('SELECT DB_NAME() AS current_db');
      console.log(`✅ Connected to MSSQL target: ${verifyQuery.recordset[0].current_db}\n`);
    }

    // ========================================
    // STEP 3: Sync Each Table
    // ========================================
    console.log('🔄 Starting table synchronization...\n');
    
    for (const table of tables) {
      const tableStartTime = Date.now();
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 Processing table: ${table}`);
      console.log(`${'='.repeat(60)}`);
      
      try {
        // Fetch source schema and data
        console.log(`\n[1/6] Fetching source schema and data...`);
        let sourceData = [];
        let sourceColumns = [];
        let sourceSchema = [];

        if (sourceDB === "postgresql") {
          sourceSchema = await getPostgresSchema(sourceClient, table);
          sourceColumns = sourceSchema.map(row => row.column_name);
          const dataQuery = await sourceClient.query(`SELECT * FROM "${table}"`);
          sourceData = dataQuery.rows;
        } else if (sourceDB === "mssql") {
          sourceSchema = await getMssqlSchema(sourcePool, table);
          sourceColumns = sourceSchema.map(row => row.column_name);
          const dataQuery = await sourcePool.request().query(`SELECT * FROM [${table}]`);
          sourceData = dataQuery.recordset;
        }

        console.log(`   ✓ Found ${sourceColumns.length} columns, ${sourceData.length} rows`);

        // Check if target table exists
        console.log(`\n[2/6] Checking if table exists in target...`);
        let tableExists = false;
        if (targetDB === "postgresql") {
          tableExists = await postgresTableExists(targetClient, table);
        } else if (targetDB === "mssql") {
          tableExists = await mssqlTableExists(targetPool, table);
        }
        console.log(`   ✓ Table ${tableExists ? 'exists' : 'does not exist'}`);

        // Create table if it doesn't exist
        const tableCreated = !tableExists;
        if (!tableExists) {
          console.log(`\n[3/6] Creating table in target...`);
          if (targetDB === "postgresql") {
            await createPostgresTable(targetClient, table, sourceSchema, sourceDB);
          } else if (targetDB === "mssql") {
            const sql = require("mssql");
            await createMssqlTable(targetPool, table, sourceSchema, sourceDB);
          }
        } else {
          console.log(`\n[3/6] Skipping table creation (already exists)`);
        }

        // Handle empty source tables
        if (sourceData.length === 0) {
          console.log(`\n[4/6] Source table is empty - nothing to sync`);
          results.push({
            table,
            success: true,
            message: tableCreated ? "Table created successfully (no data to sync)" : "No data to sync (source table is empty)",
            rowsInserted: 0,
            rowsUpdated: 0,
            rowsDeleted: 0,
            rowsSkipped: 0,
            rowsAffected: 0,
            tableCreated,
            duration: Date.now() - tableStartTime,
            strategy: syncStrategy
          });
          continue;
        }

        // Get target schema for data type mapping
        console.log(`\n[4/6] Fetching target table schema...`);
        let targetSchema = [];
        if (targetDB === "postgresql") {
          targetSchema = await getPostgresSchema(targetClient, table);
        } else if (targetDB === "mssql") {
          targetSchema = await getMssqlSchema(targetPool, table);
        }
        console.log(`   ✓ Target schema loaded`);

        // Detect primary keys (for merge strategy)
        console.log(`\n[5/6] Detecting primary keys...`);
        let primaryKeys = [];
        if (syncStrategy === 'merge') {
          try {
            if (targetDB === "postgresql") {
              primaryKeys = await getPostgresPrimaryKey(targetClient, table);
            } else if (targetDB === "mssql") {
              primaryKeys = await getMssqlPrimaryKey(targetPool, table);
            }
            console.log(`   ✓ Primary key(s): ${primaryKeys.length > 0 ? primaryKeys.join(', ') : 'none (will use replace strategy)'}`);
          } catch (error) {
            console.warn(`   ⚠️  Could not detect primary key: ${error.message}`);
          }
        } else {
          console.log(`   ⏭️  Skipped (using replace strategy)`);
        }

        // Execute sync strategy
        console.log(`\n[6/6] Executing ${syncStrategy} strategy...`);
        const sql = targetDB === 'mssql' ? require("mssql") : null;
        
        const syncResult = await executeSyncStrategy({
          strategy: primaryKeys.length === 0 ? 'replace' : syncStrategy,
          targetDB,
          targetClient,
          targetPool,
          tableName: table,
          sourceData,
          sourceColumns,
          targetSchema,
          primaryKeys,
          sql
        });

        const totalAffected = syncResult.inserted + syncResult.updated + syncResult.deleted;
        const duration = Date.now() - tableStartTime;

        console.log(`\n✅ Table sync completed successfully:`);
        console.log(`   • Inserted: ${syncResult.inserted}`);
        console.log(`   • Updated: ${syncResult.updated}`);
        console.log(`   • Deleted: ${syncResult.deleted}`);
        console.log(`   • Duration: ${duration}ms`);

        results.push({
          table,
          success: true,
          message: `Successfully synced ${totalAffected} row(s)${tableCreated ? ' (table created)' : ''}`,
          rowsInserted: syncResult.inserted,
          rowsUpdated: syncResult.updated,
          rowsDeleted: syncResult.deleted,
          rowsSkipped: syncResult.skipped,
          rowsAffected: totalAffected,
          tableCreated,
          duration,
          strategy: primaryKeys.length === 0 && syncStrategy === 'merge' ? 'replace (no PK)' : syncStrategy
        });

      } catch (error) {
        const duration = Date.now() - tableStartTime;
        console.error(`\n❌ Error syncing table ${table}:`, error.message);
        console.error(`   Stack:`, error.stack);
        
        results.push({
          table,
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
        });
      }
    }

    // ========================================
    // STEP 4: Close Connections
    // ========================================
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔌 Closing database connections...');
    if (sourceClient) await sourceClient.end();
    if (targetClient) await targetClient.end();
    if (sourcePool) await sourcePool.close();
    if (targetPool) await targetPool.close();
    console.log('✅ All connections closed');

    // Calculate summary statistics
    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const totalInserted = results.reduce((sum, r) => sum + r.rowsInserted, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.rowsUpdated, 0);
    const totalDeleted = results.reduce((sum, r) => sum + r.rowsDeleted, 0);
    const totalAffected = results.reduce((sum, r) => sum + r.rowsAffected, 0);

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SYNC SUMMARY');
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
        message: "Data synchronization completed",
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("\n❌ CRITICAL ERROR during synchronization:", error);
    console.error("Stack trace:", error.stack);

    // Cleanup connections on error
    try {
      if (sourceClient) await sourceClient.end();
      if (targetClient) await targetClient.end();
      if (sourcePool) await sourcePool.close();
      if (targetPool) await targetPool.close();
      console.log('🔌 Emergency connection cleanup completed');
    } catch (cleanupError) {
      console.error("⚠️  Error cleaning up connections:", cleanupError.message);
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message || "An unexpected error occurred during synchronization",
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
