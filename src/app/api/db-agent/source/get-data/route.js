import { validateAgentAuth } from "../../middleware/auth.js";
import { corsResponse, handleCorsPreFlight } from "../../middleware/cors.js";

/**
 * Sanitize data to handle binary/buffer columns that can't be JSON serialized
 * Converts Buffers to base64 strings with a special marker prefix
 */
function sanitizeData(rows) {
  return rows.map(row => {
    const sanitized = {};
    for (const [key, value] of Object.entries(row)) {
      // Handle Buffer objects (binary data)
      if (Buffer.isBuffer(value)) {
        // Mark as base64-encoded binary data with special prefix
        sanitized[key] = `__BINARY_BASE64__${value.toString('base64')}`;
      }
      // Handle Date objects
      else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      }
      // Handle null/undefined
      else if (value === null || value === undefined) {
        sanitized[key] = null;
      }
      // Handle regular values
      else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  });
}

/**
 * Handle preflight OPTIONS request
 */
export async function OPTIONS(req) {
  return handleCorsPreFlight(req);
}

/**
 * Source Agent: Get Data
 * Returns data from source database table in batches
 */
export async function POST(req) {
  console.log('\n🔷 [SOURCE AGENT] Get Data Request');

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
    const { dbType, config, connectionUrl, tableName, offset = 0, limit = 5000 } = await req.json();

    console.log(`📊 Table: ${tableName}`);
    console.log(`📊 Batch: Offset=${offset}, Limit=${limit}`);

    // Validate input
    if (!dbType || (!config && !connectionUrl) || !tableName) {
      return corsResponse(
        { success: false, message: "Database type, connection details, and table name are required" },
        400,
        req
      );
    }

    let data = [];
    let totalCount = 0;

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

      // Get total count
      const countResult = await client.query(`SELECT COUNT(*) as total FROM "${tableName}"`);
      totalCount = parseInt(countResult.rows[0].total);

      // Get batch data
      const dataResult = await client.query(
        `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      data = sanitizeData(dataResult.rows);
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

      // Get total count
      const countResult = await pool.request().query(`SELECT COUNT(*) as total FROM [${tableName}]`);
      totalCount = countResult.recordset[0].total;

      // Get batch data using OFFSET/FETCH (SQL Server 2012+)
      const dataResult = await pool.request().query(`
        SELECT * FROM [${tableName}]
        ORDER BY (SELECT NULL)
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `);
      data = sanitizeData(dataResult.recordset);
    }

    // Cleanup connections
    if (client) await client.end();
    if (pool) await pool.close();

    const hasMore = (offset + limit) < totalCount;
    const nextOffset = hasMore ? offset + limit : null;

    console.log(`✅ Retrieved ${data.length} rows (Total: ${totalCount}, HasMore: ${hasMore})`);

    return corsResponse(
      {
        success: true,
        data,
        totalCount,
        offset,
        limit,
        hasMore,
        nextOffset,
        batchNumber: Math.floor(offset / limit) + 1,
        totalBatches: Math.ceil(totalCount / limit)
      },
      200,
      req
    );

  } catch (error) {
    console.error("❌ Error fetching data:", error);

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
        message: error.message || "Failed to fetch data",
      },
      500,
      req
    );
  }
}
