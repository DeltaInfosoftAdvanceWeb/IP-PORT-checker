// Sync strategy implementations with transaction support

import { 
  getColumnSqlType, 
  convertValueForMssql,
  getPostgresPrimaryKey,
  getMssqlPrimaryKey 
} from './dbHelpers.js';

/**
 * Replace strategy for PostgreSQL target
 * Deletes all existing data and inserts new data in a transaction
 */
export async function replaceStrategyPostgres(client, tableName, sourceData, sourceColumns) {
  let inserted = 0;
  let deleted = 0;
  
  console.log(`[REPLACE] Starting transactional replace for table "${tableName}"`);
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    console.log(`[TRANSACTION] Started for table "${tableName}"`);
    
    // Delete existing data
    const deleteResult = await client.query(`DELETE FROM "${tableName}"`);
    deleted = deleteResult.rowCount || 0;
    console.log(`[DELETE] Removed ${deleted} existing rows from "${tableName}"`);
    
    if (sourceData.length === 0) {
      await client.query('COMMIT');
      console.log(`[COMMIT] Transaction completed for "${tableName}" (no data to insert)`);
      return { inserted: 0, updated: 0, deleted, skipped: 0 };
    }
    
    // Batch insert for better performance
    const columns = sourceColumns.map(c => `"${c}"`).join(', ');
    const batchSize = 1000;
    
    for (let i = 0; i < sourceData.length; i += batchSize) {
      const batch = sourceData.slice(i, i + batchSize);
      const values = batch.map((row, idx) => {
        const rowValues = sourceColumns.map((col, colIdx) => {
          return `$${idx * sourceColumns.length + colIdx + 1}`;
        });
        return `(${rowValues.join(', ')})`;
      }).join(', ');

      const flatValues = batch.flatMap(row => sourceColumns.map(col => row[col]));

      await client.query(
        `INSERT INTO "${tableName}" (${columns}) VALUES ${values}`,
        flatValues
      );
      inserted += batch.length;
      console.log(`[INSERT] Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows inserted`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log(`[COMMIT] Transaction completed for "${tableName}": ${inserted} rows inserted`);
    
    return { inserted, updated: 0, deleted, skipped: 0 };
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error(`[ROLLBACK] Transaction rolled back for "${tableName}":`, error.message);
    throw error;
  }
}

/**
 * Replace strategy for MSSQL target
 * Deletes all existing data and inserts new data in a transaction
 */
export async function replaceStrategyMssql(pool, tableName, sourceData, sourceColumns, targetSchema, sql) {
  let inserted = 0;
  let deleted = 0;
  
  console.log(`[REPLACE] Starting transactional replace for table [${tableName}]`);
  
  const transaction = new sql.Transaction(pool);
  
  try {
    // Begin transaction
    await transaction.begin();
    console.log(`[TRANSACTION] Started for table [${tableName}]`);
    
    // Delete existing data
    const deleteResult = await transaction.request().query(`DELETE FROM [${tableName}]`);
    deleted = deleteResult.rowCount || 0;
    console.log(`[DELETE] Removed ${deleted} existing rows from [${tableName}]`);
    
    if (sourceData.length === 0) {
      await transaction.commit();
      console.log(`[COMMIT] Transaction completed for [${tableName}] (no data to insert)`);
      return { inserted: 0, updated: 0, deleted, skipped: 0 };
    }
    
    // Use bulk insert within transaction
    const bulkTable = new sql.Table(tableName);
    bulkTable.create = false;
    
    // Add columns with correct data types
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
        const value = row[col];
        const schemaCol = targetSchema.find(s => s.column_name === col);
        return convertValueForMssql(value, schemaCol.data_type);
      });
      bulkTable.rows.add(...rowData);
    });
    
    // Execute bulk insert within transaction
    const request = new sql.Request(transaction);
    await request.bulk(bulkTable);
    inserted = sourceData.length;
    console.log(`[INSERT] ${inserted} rows inserted into [${tableName}]`);
    
    // Commit transaction
    await transaction.commit();
    console.log(`[COMMIT] Transaction completed for [${tableName}]: ${inserted} rows inserted`);
    
    return { inserted, updated: 0, deleted, skipped: 0 };
    
  } catch (error) {
    // Rollback on error
    if (transaction) {
      await transaction.rollback();
      console.error(`[ROLLBACK] Transaction rolled back for [${tableName}]:`, error.message);
    }
    throw error;
  }
}

/**
 * Merge strategy for PostgreSQL target
 * Upserts data based on primary key
 */
export async function mergeStrategyPostgres(client, tableName, sourceData, sourceColumns, primaryKeys) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  
  if (primaryKeys.length === 0) {
    console.warn(`[MERGE] No primary key found for "${tableName}", falling back to replace strategy`);
    throw new Error(`No primary key found for table "${tableName}". Cannot use merge strategy.`);
  }
  
  console.log(`[MERGE] Starting transactional merge for table "${tableName}" (PK: ${primaryKeys.join(', ')})`);
  
  try {
    await client.query('BEGIN');
    console.log(`[TRANSACTION] Started for table "${tableName}"`);
    
    if (sourceData.length === 0) {
      await client.query('COMMIT');
      return { inserted: 0, updated: 0, deleted: 0, skipped: 0 };
    }
    
    // Build upsert query (INSERT ... ON CONFLICT ... DO UPDATE)
    const columns = sourceColumns.map(c => `"${c}"`).join(', ');
    const conflictColumns = primaryKeys.map(pk => `"${pk}"`).join(', ');
    const updateSet = sourceColumns
      .filter(col => !primaryKeys.includes(col))
      .map(col => `"${col}" = EXCLUDED."${col}"`)
      .join(', ');
    
    const batchSize = 500; // Smaller batch for upserts
    
    for (let i = 0; i < sourceData.length; i += batchSize) {
      const batch = sourceData.slice(i, i + batchSize);
      const values = batch.map((row, idx) => {
        const rowValues = sourceColumns.map((col, colIdx) => {
          return `$${idx * sourceColumns.length + colIdx + 1}`;
        });
        return `(${rowValues.join(', ')})`;
      }).join(', ');

      const flatValues = batch.flatMap(row => sourceColumns.map(col => row[col]));

      let query;
      if (updateSet) {
        query = `
          INSERT INTO "${tableName}" (${columns}) 
          VALUES ${values}
          ON CONFLICT (${conflictColumns}) 
          DO UPDATE SET ${updateSet}
        `;
      } else {
        // If all columns are part of PK, just do nothing on conflict
        query = `
          INSERT INTO "${tableName}" (${columns}) 
          VALUES ${values}
          ON CONFLICT (${conflictColumns}) 
          DO NOTHING
        `;
      }

      const result = await client.query(query, flatValues);
      
      // PostgreSQL doesn't directly tell us inserts vs updates, estimate based on rowCount
      const affected = result.rowCount || 0;
      inserted += affected;
      console.log(`[UPSERT] Batch ${Math.floor(i / batchSize) + 1}: ${affected} rows affected`);
    }
    
    await client.query('COMMIT');
    console.log(`[COMMIT] Transaction completed for "${tableName}": ~${inserted} rows upserted`);
    
    return { inserted, updated, deleted: 0, skipped };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[ROLLBACK] Transaction rolled back for "${tableName}":`, error.message);
    throw error;
  }
}

/**
 * Merge strategy for MSSQL target
 * Upserts data based on primary key using MERGE statement
 */
export async function mergeStrategyMssql(pool, tableName, sourceData, sourceColumns, targetSchema, primaryKeys, sql) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  
  if (primaryKeys.length === 0) {
    console.warn(`[MERGE] No primary key found for [${tableName}], falling back to replace strategy`);
    throw new Error(`No primary key found for table [${tableName}]. Cannot use merge strategy.`);
  }
  
  console.log(`[MERGE] Starting transactional merge for table [${tableName}] (PK: ${primaryKeys.join(', ')})`);
  
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    console.log(`[TRANSACTION] Started for table [${tableName}]`);
    
    if (sourceData.length === 0) {
      await transaction.commit();
      return { inserted: 0, updated: 0, deleted: 0, skipped: 0 };
    }
    
    // Create temp table for bulk insert
    const tempTableName = `#TempSync_${tableName}_${Date.now()}`;
    
    // Create temp table with same structure
    const columns = sourceColumns.map(col => {
      const schemaCol = targetSchema.find(s => s.column_name === col);
      const dataType = schemaCol.data_type.toUpperCase();
      let fullType = dataType;
      
      if (['NVARCHAR', 'VARCHAR', 'NCHAR', 'CHAR'].includes(dataType)) {
        if (schemaCol.character_maximum_length === -1 || schemaCol.character_maximum_length > 4000) {
          fullType = `${dataType}(MAX)`;
        } else if (schemaCol.character_maximum_length) {
          fullType = `${dataType}(${schemaCol.character_maximum_length})`;
        }
      } else if (['DECIMAL', 'NUMERIC'].includes(dataType)) {
        if (schemaCol.numeric_precision && schemaCol.numeric_scale !== null) {
          fullType = `${dataType}(${schemaCol.numeric_precision}, ${schemaCol.numeric_scale})`;
        }
      }
      
      return `[${col}] ${fullType}`;
    });
    
    await transaction.request().query(`CREATE TABLE ${tempTableName} (${columns.join(', ')})`);
    console.log(`[TEMP TABLE] Created ${tempTableName}`);
    
    // Bulk insert into temp table
    const bulkTable = new sql.Table(tempTableName);
    bulkTable.create = false;
    
    sourceColumns.forEach(col => {
      const schemaCol = targetSchema.find(s => s.column_name === col);
      const sqlType = getColumnSqlType(schemaCol, sql);
      const isNullable = schemaCol.is_nullable === 'YES';
      bulkTable.columns.add(col, sqlType, { nullable: isNullable });
    });
    
    sourceData.forEach(row => {
      const rowData = sourceColumns.map(col => {
        const value = row[col];
        const schemaCol = targetSchema.find(s => s.column_name === col);
        return convertValueForMssql(value, schemaCol.data_type);
      });
      bulkTable.rows.add(...rowData);
    });
    
    const request = new sql.Request(transaction);
    await request.bulk(bulkTable);
    console.log(`[BULK INSERT] ${sourceData.length} rows inserted into temp table`);
    
    // Build MERGE statement
    const pkJoinCondition = primaryKeys.map(pk => `target.[${pk}] = source.[${pk}]`).join(' AND ');
    const updateSet = sourceColumns
      .filter(col => !primaryKeys.includes(col))
      .map(col => `target.[${col}] = source.[${col}]`)
      .join(', ');
    const insertColumns = sourceColumns.map(col => `[${col}]`).join(', ');
    const insertValues = sourceColumns.map(col => `source.[${col}]`).join(', ');
    
    const mergeQuery = `
      MERGE INTO [${tableName}] AS target
      USING ${tempTableName} AS source
      ON ${pkJoinCondition}
      WHEN MATCHED THEN
        UPDATE SET ${updateSet || 'target.[' + primaryKeys[0] + '] = target.[' + primaryKeys[0] + ']'}
      WHEN NOT MATCHED THEN
        INSERT (${insertColumns})
        VALUES (${insertValues})
      OUTPUT $action AS action;
    `;
    
    const mergeResult = await transaction.request().query(mergeQuery);
    
    // Count inserts and updates
    if (mergeResult.recordset) {
      mergeResult.recordset.forEach(row => {
        if (row.action === 'INSERT') inserted++;
        else if (row.action === 'UPDATE') updated++;
      });
    }
    
    console.log(`[MERGE] Completed: ${inserted} inserted, ${updated} updated`);
    
    // Clean up temp table
    await transaction.request().query(`DROP TABLE ${tempTableName}`);
    console.log(`[TEMP TABLE] Dropped ${tempTableName}`);
    
    await transaction.commit();
    console.log(`[COMMIT] Transaction completed for [${tableName}]`);
    
    return { inserted, updated, deleted: 0, skipped };
    
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
      console.error(`[ROLLBACK] Transaction rolled back for [${tableName}]:`, error.message);
    }
    throw error;
  }
}

/**
 * Execute sync strategy based on configuration
 */
export async function executeSyncStrategy(config) {
  const {
    strategy, // 'replace' or 'merge'
    targetDB,
    targetClient,
    targetPool,
    tableName,
    sourceData,
    sourceColumns,
    targetSchema,
    primaryKeys,
    sql
  } = config;
  
  console.log(`\n[SYNC STRATEGY] ${strategy.toUpperCase()} for table: ${tableName}`);
  console.log(`[DATA] ${sourceData.length} rows to sync`);
  
  if (targetDB === 'postgresql') {
    if (strategy === 'merge') {
      return await mergeStrategyPostgres(targetClient, tableName, sourceData, sourceColumns, primaryKeys);
    } else {
      return await replaceStrategyPostgres(targetClient, tableName, sourceData, sourceColumns);
    }
  } else if (targetDB === 'mssql') {
    if (strategy === 'merge') {
      return await mergeStrategyMssql(targetPool, tableName, sourceData, sourceColumns, targetSchema, primaryKeys, sql);
    } else {
      return await replaceStrategyMssql(targetPool, tableName, sourceData, sourceColumns, targetSchema, sql);
    }
  }
  
  throw new Error(`Unsupported target database: ${targetDB}`);
}
