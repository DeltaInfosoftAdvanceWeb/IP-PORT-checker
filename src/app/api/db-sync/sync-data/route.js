import { NextResponse } from "next/server";

// Helper function to map PostgreSQL types to MSSQL types
const mapPostgresToMssql = (pgType) => {
  const typeMap = {
    'integer': 'INT',
    'bigint': 'BIGINT',
    'smallint': 'SMALLINT',
    'numeric': 'DECIMAL',
    'real': 'REAL',
    'double precision': 'FLOAT',
    'character varying': 'NVARCHAR(MAX)',
    'character': 'NCHAR',
    'text': 'NVARCHAR(MAX)',
    'timestamp without time zone': 'DATETIME2',
    'timestamp with time zone': 'DATETIMEOFFSET',
    'date': 'DATE',
    'time': 'TIME',
    'boolean': 'BIT',
    'json': 'NVARCHAR(MAX)',
    'jsonb': 'NVARCHAR(MAX)',
    'uuid': 'UNIQUEIDENTIFIER',
    'bytea': 'VARBINARY(MAX)',
  };
  return typeMap[pgType.toLowerCase()] || 'NVARCHAR(MAX)';
};

// Helper function to map MSSQL types to PostgreSQL types
const mapMssqlToPostgres = (mssqlType) => {
  const typeMap = {
    'int': 'INTEGER',
    'bigint': 'BIGINT',
    'smallint': 'SMALLINT',
    'tinyint': 'SMALLINT',
    'decimal': 'NUMERIC',
    'numeric': 'NUMERIC',
    'float': 'DOUBLE PRECISION',
    'real': 'REAL',
    'nvarchar': 'VARCHAR',
    'varchar': 'VARCHAR',
    'nchar': 'CHAR',
    'char': 'CHAR',
    'text': 'TEXT',
    'ntext': 'TEXT',
    'datetime': 'TIMESTAMP',
    'datetime2': 'TIMESTAMP',
    'datetimeoffset': 'TIMESTAMP WITH TIME ZONE',
    'date': 'DATE',
    'time': 'TIME',
    'bit': 'BOOLEAN',
    'uniqueidentifier': 'UUID',
    'varbinary': 'BYTEA',
    'image': 'BYTEA',
  };
  const baseType = mssqlType.toLowerCase().split('(')[0];
  return typeMap[baseType] || 'TEXT';
};

// Helper function to map schema data types to MSSQL SQL types for TVP
const getColumnSqlType = (col, sql) => {
  const dataType = col.data_type.toLowerCase();
  const maxLength = col.character_maximum_length;

  // Handle string types
  if (dataType === 'nvarchar' || dataType === 'varchar') {
    if (maxLength === -1 || maxLength > 4000) {
      return sql.NVarChar(sql.MAX);
    }
    return sql.NVarChar(maxLength);
  }
  if (dataType === 'nchar' || dataType === 'char') {
    return sql.NChar(maxLength || 1);
  }
  if (dataType === 'text' || dataType === 'ntext') {
    return sql.NVarChar(sql.MAX);
  }

  // Handle numeric types
  if (dataType === 'int') return sql.Int;
  if (dataType === 'bigint') return sql.BigInt;
  if (dataType === 'smallint') return sql.SmallInt;
  if (dataType === 'tinyint') return sql.TinyInt;
  if (dataType === 'decimal' || dataType === 'numeric') return sql.Decimal;
  if (dataType === 'float') return sql.Float;
  if (dataType === 'real') return sql.Real;
  if (dataType === 'money') return sql.Money;
  if (dataType === 'smallmoney') return sql.SmallMoney;

  // Handle date/time types
  if (dataType === 'datetime') return sql.DateTime;
  if (dataType === 'datetime2') return sql.DateTime2;
  if (dataType === 'date') return sql.Date;
  if (dataType === 'time') return sql.Time;
  if (dataType === 'datetimeoffset') return sql.DateTimeOffset;
  if (dataType === 'smalldatetime') return sql.SmallDateTime;

  // Handle other types
  if (dataType === 'bit') return sql.Bit;
  if (dataType === 'uniqueidentifier') return sql.UniqueIdentifier;
  if (dataType === 'varbinary') {
    if (maxLength === -1 || maxLength > 8000) {
      return sql.VarBinary(sql.MAX);
    }
    return sql.VarBinary(maxLength);
  }
  if (dataType === 'binary') return sql.Binary(maxLength || 1);
  if (dataType === 'image') return sql.VarBinary(sql.MAX);

  // Default to NVarChar(MAX) for unknown types
  return sql.NVarChar(sql.MAX);
};

export async function POST(req) {
  let sourceClient = null;
  let targetClient = null;
  let sourcePool = null;
  let targetPool = null;

  try {
    const {
      sourceDB,
      targetDB,
      sourceConfig,
      targetConfig,
      sourceConnectionUrl,
      targetConnectionUrl,
      tables
    } = await req.json();

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
          message: "All fields are required",
        },
        { status: 400 }
      );
    }

    const results = [];

    // Establish source connection once
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
      console.log(`Connected to PostgreSQL source database: ${sourceConfig?.database || 'from URL'}`);
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
      console.log(`Connecting to MSSQL source database: ${sourceConfig?.database || 'from URL'}`);
      sourcePool = await sql.connect(sqlConfig);
      const verifySource = await sourcePool.request().query('SELECT DB_NAME() AS current_db');
      console.log(`Connected to MSSQL source database: ${verifySource.recordset[0].current_db}`);
    }

    // Establish target connection once
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
      console.log(`Connected to PostgreSQL target database: ${targetConfig?.database || 'from URL'}`);
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
      
      console.log(`Connecting to MSSQL target database: ${targetConfig?.database || 'from URL'}`);
      
      // For MSSQL to MSSQL on same server, create a new Pool instance
      if (sourceDB === "mssql" && sourcePool) {
        // Create a completely separate pool for target
        const { ConnectionPool } = require("mssql");
        targetPool = new ConnectionPool(sqlConfig);
        await targetPool.connect();
        console.log(`Created separate MSSQL connection pool for target`);
      } else {
        targetPool = await sql.connect(sqlConfig);
      }
      
      // Verify connection
      const verifyQuery = await targetPool.request().query('SELECT DB_NAME() AS current_db');
      console.log(`Connected to MSSQL target database: ${verifyQuery.recordset[0].current_db}`);
    }

    // Sync each table
    for (const table of tables) {
      console.log(`Starting sync for table: ${table}`);
      try {
        let sourceData = [];
        let sourceColumns = [];
        let sourceSchema = [];

        // Fetch schema and data from source
        if (sourceDB === "postgresql") {
          // Get column schema
          const schemaQuery = await sourceClient.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
          `, [table]);
          sourceSchema = schemaQuery.rows;
          sourceColumns = sourceSchema.map(row => row.column_name);

          // Get data
          const dataQuery = await sourceClient.query(`SELECT * FROM "${table}"`);
          sourceData = dataQuery.rows;
        } else if (sourceDB === "mssql") {
          // Get column schema
          const schemaQuery = await sourcePool.request().query(`
            SELECT
              COLUMN_NAME as column_name,
              DATA_TYPE as data_type,
              CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
              IS_NULLABLE as is_nullable,
              NUMERIC_PRECISION as numeric_precision,
              NUMERIC_SCALE as numeric_scale
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${table}'
            ORDER BY ORDINAL_POSITION
          `);
          sourceSchema = schemaQuery.recordset;
          sourceColumns = sourceSchema.map(row => row.column_name);

          // Get data
          const dataQuery = await sourcePool.request().query(`SELECT * FROM [${table}]`);
          sourceData = dataQuery.recordset;
        }

        // Check if target table exists
        let tableExists = false;
        if (targetDB === "postgresql") {
          const checkTable = await targetClient.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_name = $1
            )
          `, [table]);
          tableExists = checkTable.rows[0].exists;
        } else if (targetDB === "mssql") {
          const checkTable = await targetPool.request().query(`
            SELECT CASE WHEN EXISTS (
              SELECT * FROM INFORMATION_SCHEMA.TABLES
              WHERE TABLE_NAME = '${table}'
            ) THEN 1 ELSE 0 END AS table_exists
          `);
          tableExists = checkTable.recordset[0].table_exists === 1;
        }

        // Create table if it doesn't exist
        if (!tableExists) {
          console.log(`Table ${table} does not exist in target, creating it...`);
          if (targetDB === "postgresql") {
            // Create PostgreSQL table
            const columns = sourceSchema.map(col => {
              let dataType = sourceDB === "postgresql"
                ? col.data_type
                : mapMssqlToPostgres(col.data_type);

              if (col.character_maximum_length && dataType.includes('VARCHAR')) {
                dataType = `VARCHAR(${col.character_maximum_length})`;
              }

              const nullable = col.is_nullable === 'YES' ? '' : 'NOT NULL';
              return `"${col.column_name}" ${dataType} ${nullable}`.trim();
            });

            await targetClient.query(`CREATE TABLE "${table}" (${columns.join(', ')})`);
          } else if (targetDB === "mssql") {
            // Create MSSQL table
            const columns = sourceSchema.map(col => {
              let dataType;
              
              if (sourceDB === "mssql") {
                // When source is also MSSQL, preserve exact data type with length
                dataType = col.data_type.toUpperCase();
                
                // Handle string types with length
                if (['NVARCHAR', 'VARCHAR', 'NCHAR', 'CHAR'].includes(dataType)) {
                  if (col.character_maximum_length === -1 || col.character_maximum_length > 4000) {
                    dataType = `${dataType}(MAX)`;
                  } else if (col.character_maximum_length) {
                    dataType = `${dataType}(${col.character_maximum_length})`;
                  } else {
                    dataType = `${dataType}(MAX)`;
                  }
                }
                // Handle decimal/numeric with precision and scale
                else if (['DECIMAL', 'NUMERIC'].includes(dataType)) {
                  if (col.numeric_precision && col.numeric_scale !== null) {
                    dataType = `${dataType}(${col.numeric_precision}, ${col.numeric_scale})`;
                  }
                }
              } else {
                // Source is PostgreSQL
                dataType = mapPostgresToMssql(col.data_type);
                if (col.character_maximum_length && dataType.includes('NVARCHAR')) {
                  const maxLength = col.character_maximum_length > 4000 ? 'MAX' : col.character_maximum_length;
                  dataType = `NVARCHAR(${maxLength})`;
                }
              }

              const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
              return `[${col.column_name}] ${dataType} ${nullable}`.trim();
            });

            const createTableQuery = `CREATE TABLE [${table}] (${columns.join(', ')})`;
            console.log(`Creating MSSQL table with query: ${createTableQuery}`);
            await targetPool.request().query(createTableQuery);
            console.log(`Table ${table} created successfully in MSSQL`);
          }
        }

        if (sourceData.length === 0) {
          results.push({
            table,
            success: true,
            message: tableExists ? "No data to sync (source table is empty)" : "Table created successfully (no data to sync)",
            rowsAffected: 0,
            tableCreated: !tableExists,
          });
          continue;
        }

        // Truncate or delete existing data
        if (targetDB === "postgresql") {
          await targetClient.query(`TRUNCATE TABLE "${table}" CASCADE`);
        } else if (targetDB === "mssql") {
          await targetPool.request().query(`TRUNCATE TABLE [${table}]`);
        }

        // Bulk insert data
        let rowsAffected = 0;

        if (targetDB === "postgresql") {
          // Use COPY for bulk insert in PostgreSQL (much faster)
          const columns = sourceColumns.map(c => `"${c}"`).join(', ');

          // Batch insert for better performance
          const batchSize = 1000;
          for (let i = 0; i < sourceData.length; i += batchSize) {
            const batch = sourceData.slice(i, i + batchSize);
            const values = batch.map((row, idx) => {
              const rowValues = sourceColumns.map((col, colIdx) => {
                const val = row[col];
                return `$${idx * sourceColumns.length + colIdx + 1}`;
              });
              return `(${rowValues.join(', ')})`;
            }).join(', ');

            const flatValues = batch.flatMap(row => sourceColumns.map(col => row[col]));

            await targetClient.query(
              `INSERT INTO "${table}" (${columns}) VALUES ${values}`,
              flatValues
            );
            rowsAffected += batch.length;
          }
        } else if (targetDB === "mssql") {
          // Use bulk insert for MSSQL
          const sql = require("mssql");
          const bulkTable = new sql.Table(table);
          bulkTable.create = false; // Table already exists

          // Get target table schema to ensure correct data types
          const targetSchemaQuery = await targetPool.request().query(`
            SELECT
              COLUMN_NAME as column_name,
              DATA_TYPE as data_type,
              CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
              IS_NULLABLE as is_nullable,
              NUMERIC_PRECISION as numeric_precision,
              NUMERIC_SCALE as numeric_scale
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${table}'
            ORDER BY ORDINAL_POSITION
          `);
          const targetSchema = targetSchemaQuery.recordset;

          // Add columns to bulk table with correct data types
          sourceColumns.forEach(col => {
            const schemaCol = targetSchema.find(s => s.column_name === col);
            if (!schemaCol) {
              throw new Error(`Column '${col}' not found in target table schema`);
            }
            const sqlType = getColumnSqlType(schemaCol, sql);
            const isNullable = schemaCol.is_nullable === 'YES';
            bulkTable.columns.add(col, sqlType, { nullable: isNullable });
          });

          // Add rows with proper data conversion
          sourceData.forEach(row => {
            const rowData = sourceColumns.map(col => {
              let value = row[col];
              
              // Handle null values
              if (value === null || value === undefined) {
                return null;
              }
              
              const schemaCol = targetSchema.find(s => s.column_name === col);
              const dataType = schemaCol.data_type.toLowerCase();
              
              // Convert boolean values for bit columns
              if (dataType === 'bit') {
                if (typeof value === 'boolean') {
                  return value ? 1 : 0;
                }
                return value ? 1 : 0;
              }
              
              // Convert date strings to Date objects
              if (['datetime', 'datetime2', 'date', 'smalldatetime', 'datetimeoffset'].includes(dataType)) {
                if (typeof value === 'string' || typeof value === 'number') {
                  return new Date(value);
                }
              }
              
              // Handle uniqueidentifier (GUID/UUID)
              if (dataType === 'uniqueidentifier') {
                return value ? value.toString() : null;
              }
              
              return value;
            });
            
            bulkTable.rows.add(...rowData);
          });

          // Execute bulk insert
          const request = new sql.Request(targetPool);
          await request.bulk(bulkTable);

          rowsAffected = sourceData.length;
        }

        results.push({
          table,
          success: true,
          message: `Successfully synced ${rowsAffected} rows${!tableExists ? ' (table created)' : ''}`,
          rowsAffected,
          tableCreated: !tableExists,
        });
      } catch (error) {
        console.error(`Error syncing table ${table}:`, error);
        results.push({
          table,
          success: false,
          message: `Error: ${error.message}`,
          rowsAffected: 0,
          tableCreated: false,
        });
      }
    }

    // Close connections
    if (sourceClient) await sourceClient.end();
    if (targetClient) await targetClient.end();
    if (sourcePool) await sourcePool.close();
    if (targetPool) await targetPool.close();

    return NextResponse.json(
      {
        success: true,
        results,
        message: "Data synchronization completed",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error syncing data:", error);

    // Cleanup connections on error
    try {
      if (sourceClient) await sourceClient.end();
      if (targetClient) await targetClient.end();
      if (sourcePool) await sourcePool.close();
      if (targetPool) await targetPool.close();
    } catch (cleanupError) {
      console.error("Error cleaning up connections:", cleanupError);
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
