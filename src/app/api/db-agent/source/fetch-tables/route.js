import { NextResponse } from "next/server";
import { validateAgentAuth } from "../../middleware/auth.js";
import { corsResponse, handleCorsPreFlight } from "../../middleware/cors.js";

/**
 * Handle preflight OPTIONS request
 */
export async function OPTIONS() {
  return handleCorsPreFlight();
}

/**
 * Source Agent: Fetch Tables
 * Returns list of tables from source database
 */
export async function POST(req) {
  console.log('\n🔷 [SOURCE AGENT] Fetch Tables Request');

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
    const { dbType, config, connectionUrl } = await req.json();

    console.log(`📊 Database Type: ${dbType}`);
    console.log(`🔗 Connection Mode: ${connectionUrl ? 'URL' : 'Config'}`);

    // Validate input
    if (!dbType || (!config && !connectionUrl)) {
      return corsResponse(
        { success: false, message: "Database type and connection details are required" },
        400
      );
    }

    let tables = [];

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
      console.log(`✅ Connected to PostgreSQL: ${config?.database || 'from URL'}`);

      const result = await client.query(`
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY tablename
      `);

      tables = result.rows.map((row) => row.tablename);
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
      console.log(`✅ Connected to MSSQL: ${config?.database || 'from URL'}`);

      const result = await pool.request().query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `);

      tables = result.recordset.map((row) => row.TABLE_NAME);
    }

    // Cleanup connections
    if (client) await client.end();
    if (pool) await pool.close();

    console.log(`✅ Found ${tables.length} tables`);

    return corsResponse(
      { success: true, tables },
      200
    );

  } catch (error) {
    console.error("❌ Error fetching tables:", error);

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
        message: error.message || "Failed to fetch tables",
      },
      500
    );
  }
}
