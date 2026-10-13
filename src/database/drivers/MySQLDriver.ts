import mysql from 'mysql2/promise';
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

const logger = createChildLogger('MySQLDriver');

export class MySQLDriver extends BaseDriver {
  private pool: mysql.Pool | null = null;
  private transactions: Map<string, mysql.PoolConnection> = new Map();

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    const poolConfig: mysql.PoolOptions = {
      host: this.config.host,
      port: this.config.port || 3306,
      database: this.config.database,
      user: this.config.username,
      password: YOUR_PASSWORD,
      connectionLimit: this.config.poolMax || 10,
      idleTimeout: this.config.poolIdleTimeout || 30000,
    };

    if (this.config.sslEnabled) {
      poolConfig.ssl = this.config.sslOptions || {};
    }

    this.pool = mysql.createPool(poolConfig);
    
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      this.connected = true;
      logger.info(`Connected to MySQL: ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error) {
      logger.error('Failed to connect to MySQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
      logger.info('Disconnected from MySQL');
    }
  }

  isConnected(): boolean {
    return this.connected && this.pool !== null;
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) throw new Error('Not connected');
    
    const startTime = Date.now();
    try {
      const [rows, fields] = await this.pool.execute(sql, params);
      const columns = (fields as mysql.FieldPacket[]).map(f => ({
        name: f.name,
        type: f.type,
        length: f.length,
      }));
      
      const resultRows = Array.isArray(rows) ? rows.map(row => Object.values(row)) : [];
      return this.formatQueryResult(columns, resultRows, startTime);
    } catch (error: any) {
      logger.error('MySQL query error:', error.message, sql);
      throw error;
    }
  }

  async execute(sql: string, params?: any[]): Promise<{ rowCount: number; executionTime: number }> {
    if (!this.pool) throw new Error('Not connected');
    
    const startTime = Date.now();
    try {
      const [result] = await this.pool.execute(sql, params);
      return {
        rowCount: (result as any).affectedRows || 0,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('MySQL execute error:', error.message, sql);
      throw error;
    }
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    const result = await this.query('SHOW DATABASES');
    return result.rows.map(row => ({ name: row[0] }));
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const sql = `
      SELECT 
        TABLE_NAME as name,
        TABLE_TYPE as type,
        TABLE_ROWS as rowCount,
        ENGINE as engine,
        TABLE_COLLATION as charset,
        TABLE_COMMENT as comment
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;
    const result = await this.query(sql, [this.config.database]);
    
    return result.rows.map(row => ({
      name: row[0],
      type: row[1],
      rowCount: row[2],
      engine: row[3],
      charset: row[4],
      comment: row[5],
    }));
  }

  async getViews(schema?: string): Promise<TableInfo[]> {
    const sql = `
      SELECT TABLE_NAME as name, 'VIEW' as type
      FROM information_schema.VIEWS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;
    const result = await this.query(sql, [this.config.database]);
    
    return result.rows.map(row => ({ name: row[0], type: row[1] }));
  }

  async getTableSchema(table: string, schema?: string): Promise<TableSchema> {
    const columnsSql = `
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        CHARACTER_MAXIMUM_LENGTH as length,
        IS_NULLABLE as nullable,
        COLUMN_DEFAULT as default,
        COLUMN_KEY as primaryKey,
        EXTRA as extra,
        COLUMN_COMMENT as comment
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;
    const columnsResult = await this.query(columnsSql, [this.config.database, table]);
    
    const columns = columnsResult.rows.map(row => ({
      name: row[0],
      type: row[1],
      length: row[2],
      nullable: row[3] === 'YES',
      default: row[4],
      primaryKey: row[5] === 'PRI',
      autoIncrement: row[6]?.includes('auto_increment'),
      comment: row[7],
    }));

    const primaryKey = columns.filter(c => c.primaryKey).map(c => c.name);

    const indexes = await this.getIndexes(table);
    const foreignKeys = await this.getForeignKeys(table);

    return { table, columns, primaryKey, indexes, foreignKeys };
  }

  async getIndexes(table: string, schema?: string): Promise<IndexInfo[]> {
    const sql = `SHOW INDEX FROM \`${table}\``;
    const result = await this.query(sql);
    
    const indexMap = new Map<string, IndexInfo>();
    
    for (const row of result.rows) {
      const name = row[2];
      if (!indexMap.has(name)) {
        indexMap.set(name, {
          name,
          columns: [],
          unique: row[1] === 0,
          type: row[10] || 'BTREE',
        });
      }
      indexMap.get(name)!.columns.push(row[4]);
    }
    
    return Array.from(indexMap.values());
  }

  async getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]> {
    const sql = `
      SELECT 
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME,
        DELETE_RULE,
        UPDATE_RULE
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `;
    const result = await this.query(sql, [this.config.database, table]);
    
    return result.rows.map(row => ({
      column: row[0],
      refTable: row[1],
      refColumn: row[2],
      onDelete: row[3],
      onUpdate: row[4],
    }));
  }

  async getProcedures(schema?: string): Promise<ProcedureInfo[]> {
    const sql = `
      SELECT ROUTINE_NAME, ROUTINE_DEFINITION
      FROM information_schema.ROUTINES
      WHERE ROUTINE_TYPE = 'PROCEDURE' AND ROUTINE_SCHEMA = ?
    `;
    const result = await this.query(sql, [this.config.database]);
    
    return result.rows.map(row => ({ name: row[0], parameters: [], definition: row[1] }));
  }

  async getFunctions(schema?: string): Promise<FunctionInfo[]> {
    const sql = `
      SELECT ROUTINE_NAME, DATA_TYPE, ROUTINE_DEFINITION
      FROM information_schema.ROUTINES
      WHERE ROUTINE_TYPE = 'FUNCTION' AND ROUTINE_SCHEMA = ?
    `;
    const result = await this.query(sql, [this.config.database]);
    
    return result.rows.map(row => ({
      name: row[0],
      returnType: row[1],
      parameters: [],
      definition: row[2],
    }));
  }

  async executeProcedure(procedure: string, params?: any[]): Promise<any> {
    const paramList = params?.join(', ') || '';
    const sql = `CALL ${procedure}(${paramList})`;
    return this.query(sql);
  }

  async executeFunction(func: string, params?: any[]): Promise<any> {
    const paramList = params?.map(() => '?').join(', ') || '';
    const sql = `SELECT ${func}(${paramList}) as result`;
    return this.query(sql, params);
  }

  async beginTransaction(): Promise<string> {
    if (!this.pool) throw new Error('Not connected');
    
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.transactions.set(transactionId, connection);
    
    return transactionId;
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const connection = this.transactions.get(transactionId);
    if (!connection) throw new Error('Transaction not found');
    
    await connection.commit();
    connection.release();
    this.transactions.delete(transactionId);
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const connection = this.transactions.get(transactionId);
    if (!connection) throw new Error('Transaction not found');
    
    await connection.rollback();
    connection.release();
    this.transactions.delete(transactionId);
  }

  async queryInTransaction(transactionId: string, sql: string, params?: any[]): Promise<QueryResult> {
    const connection = this.transactions.get(transactionId);
    if (!connection) throw new Error('Transaction not found');
    
    const startTime = Date.now();
    const [rows, fields] = await connection.execute(sql, params);
    
    const columns = (fields as mysql.FieldPacket[]).map(f => ({
      name: f.name,
      type: f.type,
    }));
    
    const resultRows = Array.isArray(rows) ? rows.map(row => Object.values(row)) : [];
    return this.formatQueryResult(columns, resultRows, startTime);
  }
}
