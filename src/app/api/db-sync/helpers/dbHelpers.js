// Database helper functions for cross-database synchronization

// Type mapping: PostgreSQL to MSSQL
export const mapPostgresToMssql = (pgType) => {
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

// Type mapping: MSSQL to PostgreSQL
export const mapMssqlToPostgres = (mssqlType) => {
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

/**
 * Get SQL type for MSSQL bulk operations
 */
export const getColumnSqlType = (col, sql) => {
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
  if (dataType === 'decimal' || dataType === 'numeric') return sql.Decimal(col.numeric_precision, col.numeric_scale);
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

/**
 * Get table schema from PostgreSQL
 */
export async function getPostgresSchema(client, tableName) {
  const schemaQuery = await client.query(`
    SELECT 
      column_name, 
      data_type, 
      character_maximum_length, 
      is_nullable,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  
  return schemaQuery.rows;
}

/**
 * Get table schema from MSSQL
 */
export async function getMssqlSchema(pool, tableName) {
  const schemaQuery = await pool.request().query(`
    SELECT
      COLUMN_NAME as column_name,
      DATA_TYPE as data_type,
      CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
      IS_NULLABLE as is_nullable,
      NUMERIC_PRECISION as numeric_precision,
      NUMERIC_SCALE as numeric_scale
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION
  `);
  
  return schemaQuery.recordset;
}

/**
 * Get primary key columns for PostgreSQL table
 */
export async function getPostgresPrimaryKey(client, tableName) {
  const pkQuery = await client.query(`
    SELECT a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
    AND i.indisprimary
    ORDER BY array_position(i.indkey, a.attnum)
  `, [tableName]);
  
  return pkQuery.rows.map(row => row.column_name);
}

/**
 * Get primary key columns for MSSQL table
 */
export async function getMssqlPrimaryKey(pool, tableName) {
  const pkQuery = await pool.request().query(`
    SELECT COLUMN_NAME as column_name
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
    AND TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION
  `);
  
  return pkQuery.recordset.map(row => row.column_name);
}

/**
 * Check if table exists in PostgreSQL
 */
export async function postgresTableExists(client, tableName) {
  const checkTable = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = $1
    )
  `, [tableName]);
  
  return checkTable.rows[0].exists;
}

/**
 * Check if table exists in MSSQL
 */
export async function mssqlTableExists(pool, tableName) {
  const checkTable = await pool.request().query(`
    SELECT CASE WHEN EXISTS (
      SELECT * FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '${tableName}'
    ) THEN 1 ELSE 0 END AS table_exists
  `);
  
  return checkTable.recordset[0].table_exists === 1;
}

/**
 * Create table in PostgreSQL from schema
 */
export async function createPostgresTable(client, tableName, sourceSchema, sourceDB) {
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

  await client.query(`CREATE TABLE "${tableName}" (${columns.join(', ')})`);
  console.log(`✓ Table "${tableName}" created in PostgreSQL`);
}

/**
 * Create table in MSSQL from schema
 */
export async function createMssqlTable(pool, tableName, sourceSchema, sourceDB) {
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

  const createTableQuery = `CREATE TABLE [${tableName}] (${columns.join(', ')})`;
  console.log(`Creating MSSQL table: ${createTableQuery}`);
  await pool.request().query(createTableQuery);
  console.log(`✓ Table [${tableName}] created in MSSQL`);
}

/**
 * Convert data value for MSSQL bulk insert
 */
export function convertValueForMssql(value, dataType) {
  // Handle null values
  if (value === null || value === undefined) {
    return null;
  }
  
  const type = dataType.toLowerCase();
  
  // Convert boolean values for bit columns
  if (type === 'bit') {
    return value ? 1 : 0;
  }
  
  // Convert date strings to Date objects
  if (['datetime', 'datetime2', 'date', 'smalldatetime', 'datetimeoffset'].includes(type)) {
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
  }
  
  // Handle uniqueidentifier (GUID/UUID)
  if (type === 'uniqueidentifier') {
    return value ? value.toString() : null;
  }
  
  return value;
}
