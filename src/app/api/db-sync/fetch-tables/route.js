import { NextResponse } from "next/server";


export async function POST(req) {
  try {

    const { dbType, config, connectionUrl } = await req.json();

    if (!dbType) {
      return NextResponse.json(
        {
          success: false,
          message: "Database type is required",
        },
        { status: 400 }
      );
    }

    if (!config && !connectionUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "Either configuration or connection URL is required",
        },
        { status: 400 }
      );
    }

    let tables = [];

    // 4️⃣ Connect to database and fetch tables
    if (dbType === "postgresql") {
      const { Client } = require("pg");
      let client;

      if (connectionUrl) {
        // Using connection URL
        client = new Client({
          connectionString: connectionUrl,
          connectionTimeoutMillis: 10000,
        });
      } else {
        // Using manual config
        const { host, port, database, username, password } = config;

        if (!host || !port || !database || !username || !password) {
          return NextResponse.json(
            {
              success: false,
              message: "All configuration fields are required",
            },
            { status: 400 }
          );
        }

        client = new Client({
          host,
          port: parseInt(port),
          database,
          user: username,
          password,
          connectionTimeoutMillis: 10000,
        });
      }

      try {
        await client.connect();
        const result = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        tables = result.rows.map((row) => row.table_name);
        await client.end();
      } catch (error) {
        console.error("PostgreSQL connection error:", error);
        return NextResponse.json(
          {
            success: false,
            message: `PostgreSQL Error: ${error.message}`,
          },
          { status: 500 }
        );
      }
    } else if (dbType === "mssql") {
      const sql = require("mssql");
      let sqlConfig;

      if (connectionUrl) {
        // Using connection URL/string
        sqlConfig = connectionUrl;
      } else {
        // Using manual config
        const { host, port, database, username, password } = config;

        if (!host || !port || !database || !username || !password) {
          return NextResponse.json(
            {
              success: false,
              message: "All configuration fields are required",
            },
            { status: 400 }
          );
        }

        sqlConfig = {
          user: username,
          password: password,
          server: host,
          port: parseInt(port),
          database: database,
          options: {
            encrypt: true,
            trustServerCertificate: true,
            connectionTimeout: 10000,
          },
        };
      }

      try {
        const pool = await sql.connect(sqlConfig);
        const result = await pool.request().query(`
          SELECT TABLE_NAME
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME
        `);
        tables = result.recordset.map((row) => row.TABLE_NAME);
        await pool.close();
      } catch (error) {
        console.error("MSSQL connection error:", error);
        return NextResponse.json(
          {
            success: false,
            message: `MSSQL Error: ${error.message}`,
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Unsupported database type",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        tables,
        message: `Successfully fetched ${tables.length} tables`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
