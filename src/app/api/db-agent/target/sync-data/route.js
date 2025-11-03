import { validateAgentAuth } from "../../middleware/auth.js";
import { corsResponse, handleCorsPreFlight } from "../../middleware/cors.js";
import { getPostgresSchema, getMssqlSchema, getPostgresPrimaryKey, getMssqlPrimaryKey } from "../../../db-sync/helpers/dbHelpers.js";
import { executeSyncStrategy } from "../../../db-sync/helpers/syncStrategies.js";

/**
 * Handle preflight OPTIONS request
 */
export async function OPTIONS() {
  return handleCorsPreFlight();
}

/**
 * Target Agent: Sync Data
 * Inserts/updates data batch in target database
 */
export async function POST(req) {
  console.log('\n🔶 [TARGET AGENT] Sync Data Request');

  // Validate authentication
  const authResult = await validateAgentAuth(req);
  if (!authResult.authenticated) {
    console.error('❌ Authentication failed:', authResult.error);
    return corsResponse(
      { success: false, message: authResult.error },
      401
    );
  }

  let client = null;
  let pool = null;

  try {
    const {
      dbType,
      config,
      connectionUrl,
      tableName,
      data,
      columns,
      syncStrategy = 'replace',
      isFirstBatch = false,
      isLastBatch = false
    } = await req.json();

    console.log(`📊 Table: ${tableName}`);
    console.log(`📊 Strategy: ${syncStrategy}`);
    console.log(`📊 Batch Size: ${data?.length || 0} rows`);
    console.log(`📊 First Batch: ${isFirstBatch}, Last Batch: ${isLastBatch}`);

    // Validate input
    if (!dbType || (!config && !connectionUrl) || !tableName || !data || !columns) {
      return corsResponse(
        { success: false, message: "All required fields must be provided" },
        400
      );
    }

    let syncResult = { inserted: 0, updated: 0, deleted: 0, skipped: 0 };

    // Connect to PostgreSQL
    if (dbType === "postgresql") {
      const { Client } = require("pg");
      client = connectionUrl
        ? new Client({ connectionString: connectionUrl, connectionTimeoutMillis: 10000 })
        : new Client({
            host: config.host,
            port: parseInt(config.port),
            database: config.database,
            user: config.username,
            password: config.password,
            connectionTimeoutMillis: 10000,
          });

      await client.connect();
      console.log(`✅ Connected to PostgreSQL`);

      // Get target schema
      const targetSchema = await getPostgresSchema(client, tableName);

      // Get primary keys if using merge strategy
      let primaryKeys = [];
      if (syncStrategy === 'merge') {
        try {
          primaryKeys = await getPostgresPrimaryKey(client, tableName);
          console.log(`ℹ️ Primary Keys: ${primaryKeys.join(', ') || 'none'}`);
        } catch (error) {
          console.warn(`⚠️ Could not detect primary key: ${error.message}`);
        }
      }

      // If first batch and replace strategy, delete all existing data
      if (isFirstBatch && syncStrategy === 'replace') {
        console.log(`🗑️ Deleting existing data (replace strategy)`);
        await client.query(`DELETE FROM "${tableName}"`);
      }

      // Execute sync
      const actualStrategy = (syncStrategy === 'merge' && primaryKeys.length === 0) ? 'replace' : syncStrategy;

      if (actualStrategy === 'replace') {
        // For replace, just insert all data
        await client.query('BEGIN');
        try {
          const batchColumns = columns.map(c => `"${c}"`).join(', ');

          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const values = columns.map((_, idx) => `$${idx + 1}`);
            const flatValues = columns.map(col => row[col]);

            await client.query(
              `INSERT INTO "${tableName}" (${batchColumns}) VALUES (${values.join(', ')})`,
              flatValues
            );
          }

          await client.query('COMMIT');
          syncResult.inserted = data.length;
          console.log(`✅ Inserted ${data.length} rows`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      } else {
        // Use merge strategy (upsert)
        const result = await executeSyncStrategy({
          strategy: 'merge',
          targetDB: dbType,
          targetClient: client,
          targetPool: null,
          tableName,
          sourceData: data,
          sourceColumns: columns,
          targetSchema,
          primaryKeys,
          sql: null
        });
        syncResult = result;
      }
    }
    // Connect to MSSQL
    else if (dbType === "mssql") {
      const sql = require("mssql");
      const sqlConfig = connectionUrl
        ? connectionUrl
        : {
            user: config.username,
            password: config.password,
            server: config.host,
            port: parseInt(config.port),
            database: config.database,
            options: {
              encrypt: true,
              trustServerCertificate: true,
              connectionTimeout: 10000,
            },
          };

      pool = await sql.connect(sqlConfig);
      console.log(`✅ Connected to MSSQL`);

      // Get target schema
      const targetSchema = await getMssqlSchema(pool, tableName);

      // Get primary keys if using merge strategy
      let primaryKeys = [];
      if (syncStrategy === 'merge') {
        try {
          primaryKeys = await getMssqlPrimaryKey(pool, tableName);
          console.log(`ℹ️ Primary Keys: ${primaryKeys.join(', ') || 'none'}`);
        } catch (error) {
          console.warn(`⚠️ Could not detect primary key: ${error.message}`);
        }
      }

      // If first batch and replace strategy, delete all existing data
      if (isFirstBatch && syncStrategy === 'replace') {
        console.log(`🗑️ Deleting existing data (replace strategy)`);
        await pool.request().query(`DELETE FROM [${tableName}]`);
      }

      // Execute sync
      const actualStrategy = (syncStrategy === 'merge' && primaryKeys.length === 0) ? 'replace' : syncStrategy;

      const result = await executeSyncStrategy({
        strategy: actualStrategy,
        targetDB: dbType,
        targetClient: null,
        targetPool: pool,
        tableName,
        sourceData: data,
        sourceColumns: columns,
        targetSchema,
        primaryKeys,
        sql
      });
      syncResult = result;
    }

    // Cleanup connections
    if (client) await client.end();
    if (pool) await pool.close();

    console.log(`✅ Sync completed: +${syncResult.inserted} ~${syncResult.updated} -${syncResult.deleted}`);

    return corsResponse(
      {
        success: true,
        ...syncResult
      },
      200
    );

  } catch (error) {
    console.error("❌ Error syncing data:", error);

    // Cleanup on error
    try {
      if (client) await client.end();
      if (pool) await pool.close();
    } catch (cleanupError) {
      console.error("⚠️ Error cleaning up connections:", cleanupError);
    }

    return corsResponse(
      {
        success: false,
        message: error.message || "Failed to sync data",
      },
      500
    );
  }
}
