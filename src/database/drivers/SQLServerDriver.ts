import tedious from 'tedious';
import { BaseDriver } from './BaseDriver';
import type {
  DatabaseConfig,
  QueryResult,
  TableInfo,
  TableSchema,
  IndexInfo,
  ForeignKeyInfo,
  DatabaseInfo,
  ProcedureInfo,
  FunctionInfo,
} from '@/types';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('SQLServerDriver');

interface TediousColumn {
  colName: string;
  type?: { name: string };
}

interface TediousRow {
  [key: string]: { value: any };
}

export class SQLServerDriver extends BaseDriver {
  private pool: tedious.ConnectionPool | null = null;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    const poolConfig: tedious.ConnectionPoolConfiguration = {
      server: this.config.host || 'localhost',
      options: {
        port: this.config.port || 1433,
        database: this.config.database,
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 15000,
        requestTimeout: this.config.poolIdleTimeout || 30000,
      },
      authentication: {
        type: 'default',
        options: {
          userName: this.config.username || 'sa',
          password: YOUR_PASSWORD || '',
        },
      },
      pool: {
        min: this.config.poolMin || 2,
        max: this.config.poolMax || 10,
        idleTimeoutMillis: this.config.poolIdleTimeout || 30000,
      },
    };

    this.pool = new tedious.ConnectionPool(poolConfig);

    try {
      await this.pool.connect();
      this.connected = true;
      logger.info(`Connected to SQL Server: ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error: any) {
      logger.error('Failed to connect to SQL Server:', error.message);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      this.connected = false;
      logger.info('Disconnected from SQL Server');
    }
  }

  isConnected(): boolean {
    return this.connected && this.pool !== null;
  }

  private executeRequest(sql: string, params?: any[]): Promise<{ columns: TediousColumn[]; rows: TediousRow[]; rowCount: number }> {
    return new Promise((resolve, reject) => {
      if (!this.pool) {
        reject(new Error('Not connected'));
        return;
      }

      const columns: TediousColumn[] = [];
      const rows: TediousRow[] = [];
      let rowCount = 0;

      const request = new tedious.Request(sql, (err: Error | null | undefined, rc: number | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        rowCount = rc || 0;
        resolve({ columns, rows, rowCount });
      });

      request.on('columnMetadata', (cols: TediousColumn[]) => {
        columns.push(...cols);
      });

      request.on('row', (row: TediousRow[]) => {
        rows.push(...row);
      });

      if (params && params.length > 0) {
        params.forEach((param, index) => {
          request.addParameter(`p${index}`, tedious.TYPES.NVarChar, String(param));
        });
      }

      this.pool!.execSql(request);
    });
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();
    try {
      const result = await this.executeRequest(sql, params);
      
      const columns = result.columns.map(col => ({
        name: col.colName,
        type: col.type?.name || 'UNKNOWN',
      }));

      const resultRows = result.rows.map(row =>
        columns.map(col => {
          const cell = row[col.name];
          return cell?.value ?? null;
        })
      );

      return {
        columns,
        rows: resultRows,
        rowCount: result.rowCount,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('SQL Server query error:', error.message, sql);
      throw error;
    }
  }

  async execute(sql: string, params?: any[]): Promise<{ rowCount: number; executionTime: number }> {
    const startTime = Date.now();
    try {
      const result = await this.executeRequest(sql, params);
      return {
        rowCount: result.rowCount,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('SQL Server execute error:', error.message, sql);
      throw error;
    }
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    const result = await this.query(`
      SELECT name FROM sys.databases
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `);
    return result.rows.map(row => ({ name: row[0] }));
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const schemaName = schema || 'dbo';
    const result = await this.query(`
      SELECT 
        t.name AS name,
        'TABLE' AS type,
        SUM(p.rows) AS rowCount
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
      WHERE s.name = '${schemaName}'
      GROUP BY t.name
      ORDER BY t.name
    `);
    return result.rows.map(row => ({
      name: row[0],
      type: row[1],
      rowCount: row[2],
    }));
  }

  async getViews(schema?: string): Promise<TableInfo[]> {
    const schemaName = schema || 'dbo';
    const result = await this.query(`
      SELECT v.name AS name, 'VIEW' AS type
      FROM sys.views v
      JOIN sys.schemas s ON v.schema_id = s.schema_id
      WHERE s.name = '${schemaName}'
      ORDER BY v.name
    `);
    return result.rows.map(row => ({ name: row[0], type: row[1] }));
  }

  async getTableSchema(table: string, schema?: string): Promise<TableSchema> {
    const schemaName = schema || 'dbo';
    
    const columnsResult = await this.query(`
      SELECT 
        c.name AS name,
        ty.name AS type,
        c.max_length AS length,
        c.is_nullable AS nullable,
        dc.definition AS default,
        CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS primaryKey,
        c.is_identity AS autoIncrement,
        ep.value AS comment
      FROM sys.columns c
      JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      JOIN sys.tables t ON c.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
      LEFT JOIN (
        SELECT ic.object_id, ic.column_id
        FROM sys.index_columns ic
        JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
      ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
      LEFT JOIN sys.extended_properties ep ON c.object_id = ep.major_id AND c.column_id = ep.minor_id AND ep.name = 'MS_Description'
      WHERE t.name = '${table}' AND s.name = '${schemaName}'
      ORDER BY c.column_id
    `);

    const columns = columnsResult.rows.map(row => ({
      name: row[0],
      type: row[1],
      length: row[2],
      nullable: row[3] === 1,
      default: row[4],
      primaryKey: row[5] === 1,
      autoIncrement: row[6] === 1,
      comment: row[7],
    }));

    const primaryKey = columns.filter(c => c.primaryKey).map(c => c.name);
    const indexes = await this.getIndexes(table, schema);
    const foreignKeys = await this.getForeignKeys(table, schema);

    return { table, columns, primaryKey, indexes, foreignKeys };
  }

  async getIndexes(table: string, schema?: string): Promise<IndexInfo[]> {
    const schemaName = schema || 'dbo';
    const result = await this.query(`
      SELECT 
        i.name AS name,
        i.is_unique AS unique,
        i.type_desc AS type,
        STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
      FROM sys.indexes i
      JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE t.name = '${table}' AND s.name = '${schemaName}' AND i.type > 0
      GROUP BY i.name, i.is_unique, i.type_desc
    `);

    return result.rows.map(row => ({
      name: row[0],
      columns: (row[3] || '').split(','),
      unique: row[1] === 1,
      type: row[2],
    }));
  }

  async getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]> {
    const schemaName = schema || 'dbo';
    const result = await this.query(`
      SELECT 
        fk.name AS fkName,
        c1.name AS column,
        OBJECT_NAME(fk.referenced_object_id) AS refTable,
        c2.name AS refColumn,
        fk.delete_referential_action_desc AS onDelete,
        fk.update_referential_action_desc AS onUpdate
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.tables t ON fk.parent_object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
      JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
      WHERE t.name = '${table}' AND s.name = '${schemaName}'
    `);

    return result.rows.map(row => ({
      column: row[1],
      refTable: row[2],
      refColumn: row[3],
      onDelete: row[4],
      onUpdate: row[5],
    }));
  }

  async getProcedures(schema?: string): Promise<ProcedureInfo[]> {
    const schemaName = schema || 'dbo';
    const result = await this.query(`
      SELECT p.name AS name
      FROM sys.procedures p
      JOIN sys.schemas s ON p.schema_id = s.schema_id
      WHERE s.name = '${schemaName}'
      ORDER BY p.name
    `);

    return result.rows.map(row => ({
      name: row[0],
      parameters: [],
    }));
  }

  async getFunctions(schema?: string): Promise<FunctionInfo[]> {
    const schemaName = schema || 'dbo';
    const result = await this.query(`
      SELECT o.name AS name
      FROM sys.objects o
      JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE o.type IN ('FN', 'IF', 'TF') AND s.name = '${schemaName}'
      ORDER BY o.name
    `);

    return result.rows.map(row => ({
      name: row[0],
      returnType: 'unknown',
      parameters: [],
    }));
  }

  async executeProcedure(procedure: string, params?: any[]): Promise<any> {
    const paramList = params?.map(() => '?').join(', ') || '';
    return this.query(`EXEC ${procedure} ${paramList}`, params);
  }

  async executeFunction(func: string, params?: any[]): Promise<any> {
    const paramList = params?.map(() => '?').join(', ') || '';
    const sql = `SELECT dbo.${func}(${paramList}) as result`;
    return this.query(sql, params);
  }

  async beginTransaction(): Promise<string> {
    if (!this.pool) throw new Error('Not connected');

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.pool!.beginTransaction((err: Error | null | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(transactionId);
      });
    });
  }

  async commitTransaction(transactionId: string): Promise<void> {
    if (!this.pool) throw new Error('Not connected');

    return new Promise((resolve, reject) => {
      this.pool!.commitTransaction((err: Error | null | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    if (!this.pool) throw new Error('Not connected');

    return new Promise((resolve, reject) => {
      this.pool!.rollbackTransaction((err: Error | null | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async queryInTransaction(transactionId: string, sql: string, params?: any[]): Promise<QueryResult> {
    return this.query(sql, params);
  }
}
