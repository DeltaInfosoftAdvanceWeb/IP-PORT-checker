import { NextResponse } from "next/server";
import { validateAgentAuth } from "../../middleware/auth.js";
import { corsResponse, handleCorsPreFlight } from "../../middleware/cors.js";
import { getPostgresSchema, getMssqlSchema } from "../../../db-sync/helpers/dbHelpers.js";

/**
 * Handle preflight OPTIONS request
 */
export async function OPTIONS() {
  return handleCorsPreFlight();
}

/**
 * Source Agent: Get Schema
 * Returns table schema from source database
 */
export async function POST(req) {
  console.log('\n🔷 [SOURCE AGENT] Get Schema Request');

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
    const { dbType, config, connectionUrl, tableName } = await req.json();

    console.log(`📊 Table: ${tableName}`);
    console.log(`📊 Database Type: ${dbType}`);

    // Validate input
    if (!dbType || (!config && !connectionUrl) || !tableName) {
      return corsResponse(
        { success: false, message: "Database type, connection details, and table name are required" },
        400
      );
    }

    let schema = [];

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

      schema = await getPostgresSchema(client, tableName);
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

      schema = await getMssqlSchema(pool, tableName);
    }

    // Cleanup connections
    if (client) await client.end();
    if (pool) await pool.close();

    console.log(`✅ Schema retrieved: ${schema.length} columns`);

    return corsResponse(
      { success: true, schema },
      200
    );

  } catch (error) {
    console.error("❌ Error fetching schema:", error);

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
        message: error.message || "Failed to fetch schema",
      },
      500
    );
  }
}
