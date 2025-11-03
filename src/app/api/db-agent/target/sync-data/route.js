import { validateAgentAuth } from "../../middleware/auth.js";
import { corsResponse, handleCorsPreFlight } from "../../middleware/cors.js";
import { getPostgresSchema, getMssqlSchema, getPostgresPrimaryKey, getMssqlPrimaryKey } from "../../../db-sync/helpers/dbHelpers.js";
import { executeSyncStrategy } from "../../../db-sync/helpers/syncStrategies.js";

/**
 * Handle preflight OPTIONS request
 */
export async function OPTIONS(req) {
  return handleCorsPreFlight(req);
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
      401,
      req
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
        400,
        req
      );
    }

    let syncResult = { inserted: 0, updated: 0, deleted: 0, skipped: 0 };

    // Connect to PostgreSQL
    if (dbType === "postgresql") {
      const { Client } = require("pg");
      client = connectionUrl
        ? new Client({
            connectionString: connectionUrl,
            connectionTimeoutMillis: 30000,
            query_timeout: 60000,
            statement_timeout: 60000
          })
        : new Client({
            host: config.host,
            port: parseInt(config.port),
            database: config.database,
            user: config.username,
            password: config.password,
            connectionTimeoutMillis: 30000,
            query_timeout: 60000,
            statement_timeout: 60000
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
        // For replace, use optimized bulk insert (multi-row VALUES)
        await client.query('BEGIN');
        try {
          const batchColumns = columns.map(c => `"${c}"`).join(', ');

          // Bulk insert in chunks of 1000 rows for optimal performance
          const CHUNK_SIZE = 1000;
          let totalInserted = 0;

          for (let chunkStart = 0; chunkStart < data.length; chunkStart += CHUNK_SIZE) {
            const chunk = data.slice(chunkStart, chunkStart + CHUNK_SIZE);

            // Build multi-row INSERT statement
            const valuesClauses = [];
            const allValues = [];
            let paramIndex = 1;

            for (const row of chunk) {
              const rowPlaceholders = columns.map(() => `$${paramIndex++}`);
              valuesClauses.push(`(${rowPlaceholders.join(', ')})`);
              allValues.push(...columns.map(col => row[col]));
            }

            const insertQuery = `INSERT INTO "${tableName}" (${batchColumns}) VALUES ${valuesClauses.join(', ')}`;
            await client.query(insertQuery, allValues);
            totalInserted += chunk.length;
          }

          await client.query('COMMIT');
          syncResult.inserted = totalInserted;
          console.log(`✅ Bulk inserted ${totalInserted} rows (optimized multi-row)`);
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
              connectionTimeout: 30000,
              requestTimeout: 60000,
            },
            pool: {
              max: 10,
              min: 2,
              idleTimeoutMillis: 30000
            }
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
      200,
      req
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
      500,
      req
    );
  }
}
