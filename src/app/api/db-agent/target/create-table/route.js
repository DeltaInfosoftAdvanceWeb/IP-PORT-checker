import { validateAgentAuth } from "../../middleware/auth.js";
import { corsResponse, handleCorsPreFlight } from "../../middleware/cors.js";
import { createPostgresTable, createMssqlTable, postgresTableExists, mssqlTableExists } from "../../../db-sync/helpers/dbHelpers.js";

/**
 * Handle preflight OPTIONS request
 */
export async function OPTIONS(req) {
  return handleCorsPreFlight(req);
}

/**
 * Target Agent: Create Table
 * Creates table in target database if it doesn't exist
 */
export async function POST(req) {
  console.log('\n🔶 [TARGET AGENT] Create Table Request');

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
    const { dbType, config, connectionUrl, tableName, schema, sourceDB } = await req.json();

    console.log(`📊 Table: ${tableName}`);
    console.log(`📊 Database Type: ${dbType}`);
    console.log(`📊 Schema Columns: ${schema?.length || 0}`);

    // Validate input
    if (!dbType || (!config && !connectionUrl) || !tableName || !schema || !sourceDB) {
      return corsResponse(
        { success: false, message: "All required fields must be provided" },
        400,
        req
      );
    }

    let tableCreated = false;
    let tableExists = false;

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

      // Check if table exists
      tableExists = await postgresTableExists(client, tableName);

      if (!tableExists) {
        await createPostgresTable(client, tableName, schema, sourceDB);
        tableCreated = true;
        console.log(`✅ Table "${tableName}" created`);
      } else {
        console.log(`ℹ️ Table "${tableName}" already exists`);
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

      // Check if table exists
      tableExists = await mssqlTableExists(pool, tableName);

      if (!tableExists) {
        await createMssqlTable(pool, tableName, schema, sourceDB);
        tableCreated = true;
        console.log(`✅ Table [${tableName}] created`);
      } else {
        console.log(`ℹ️ Table [${tableName}] already exists`);
      }
    }

    // Cleanup connections
    if (client) await client.end();
    if (pool) await pool.close();

    return corsResponse(
      {
        success: true,
        tableCreated,
        tableExists,
        message: tableCreated ? "Table created successfully" : "Table already exists"
      },
      200,
      req
    );

  } catch (error) {
    console.error("❌ Error creating table:", error);

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
        message: error.message || "Failed to create table",
      },
      500,
      req
    );
  }
}
