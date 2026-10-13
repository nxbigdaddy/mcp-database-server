import pg from 'pg';
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

const logger = createChildLogger('PostgreSQLDriver');

export class PostgreSQLDriver extends BaseDriver {
  private pool: pg.Pool | null = null;
  private clients: Map<string, pg.PoolClient> = new Map();

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    const poolConfig: pg.PoolConfig = {
      host: this.config.host,
      port: this.config.port || 5432,
      database: this.config.database,
      user: this.config.username,
      password: YOUR_PASSWORD,
      min: this.config.poolMin || 2,
      max: this.config.poolMax || 10,
      idleTimeoutMillis: this.config.poolIdleTimeout || 30000,
    };

    if (this.config.sslEnabled) {
      poolConfig.ssl = this.config.sslOptions || {};
    }

    this.pool = new pg.Pool(poolConfig);
    
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.connected = true;
      logger.info(`Connected to PostgreSQL: ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
      logger.info('Disconnected from PostgreSQL');
    }
  }

  isConnected(): boolean {
    return this.connected && this.pool !== null;
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) throw new Error('Not connected');
    
    const startTime = Date.now();
    try {
      const result = await this.pool.query(sql, params);
      const columns = result.fields.map(f => ({
        name: f.name,
        type: f.dataTypeID,
      }));
      
      const rows = result.rows.map(row => Object.values(row));
      return this.formatQueryResult(columns, rows, startTime);
    } catch (error: any) {
      logger.error('PostgreSQL query error:', error.message, sql);
      throw error;
    }
  }

  async execute(sql: string, params?: any[]): Promise<{ rowCount: number; executionTime: number }> {
    if (!this.pool) throw new Error('Not connected');
    
    const startTime = Date.now();
    try {
      const result = await this.pool.query(sql, params);
      return {
        rowCount: result.rowCount || 0,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('PostgreSQL execute error:', error.message, sql);
      throw error;
    }
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    const sql = 'SELECT datname as name, pg_database_size(datname) as size FROM pg_database WHERE datistemplate = false';
    const result = await this.query(sql);
    return result.rows.map(row => ({ name: row[0], size: row[1] }));
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const sql = `
      SELECT 
        table_name as name,
        'TABLE' as type,
        (xpath('/row/cnt/text()', xml_count))[1]::text::int as rowCount
      FROM information_schema.tables t
      CROSS JOIN (
        SELECT xmlagg(xmlelement(s, count(*))) as xml_count
        FROM information_schema.tables
      ) as xc
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const result = await this.query(sql, [schema || 'public']);
    
    return result.rows.map(row => ({ name: row[0], type: row[1], rowCount: row[2] }));
  }

  async getViews(schema?: string): Promise<TableInfo[]> {
    const sql = `
      SELECT table_name as name, 'VIEW' as type
      FROM information_schema.views
      WHERE table_schema = $1
      ORDER BY table_name
    `;
    const result = await this.query(sql, [schema || 'public']);
    
    return result.rows.map(row => ({ name: row[0], type: row[1] }));
  }

  async getTableSchema(table: string, schema?: string): Promise<TableSchema> {
    const columnsSql = `
      SELECT 
        column_name as name,
        data_type as type,
        character_maximum_length as length,
        is_nullable as nullable,
        column_default as default,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as primaryKey
      FROM information_schema.columns
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1 AND tc.table_schema = $2
      ) pk ON columns.column_name = pk.column_name
      WHERE table_name = $1 AND table_schema = $2
      ORDER BY ordinal_position
    `;
    const columnsResult = await this.query(columnsSql, [table, schema || 'public']);
    
    const columns = columnsResult.rows.map(row => ({
      name: row[0],
      type: row[1],
      length: row[2],
      nullable: row[3] === 'YES',
      default: row[4],
      primaryKey: row[5],
      autoIncrement: typeof row[4] === 'string' && row[4].includes('nextval'),
    }));

    const primaryKey = columns.filter(c => c.primaryKey).map(c => c.name);
    const indexes = await this.getIndexes(table, schema);
    const foreignKeys = await this.getForeignKeys(table, schema);

    return { table, columns, primaryKey, indexes, foreignKeys };
  }

  async getIndexes(table: string, schema?: string): Promise<IndexInfo[]> {
    const sql = `
      SELECT 
        indexname as name,
        indexdef,
        CASE WHEN indexdef LIKE '%UNIQUE%' THEN true ELSE false END as unique
      FROM pg_indexes
      WHERE tablename = $1 AND schemaname = $2
    `;
    const result = await this.query(sql, [table, schema || 'public']);
    
    return result.rows.map(row => ({
      name: row[0],
      columns: [],
      unique: row[2],
      type: 'BTREE',
    }));
  }

  async getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]> {
    const sql = `
      SELECT 
        kcu.column_name,
        ccu.table_name AS ref_table,
        ccu.column_name AS ref_column,
        rc.delete_rule AS on_delete,
        rc.update_rule AS on_update
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.constraint_column_usage ccu 
        ON kcu.constraint_name = ccu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON kcu.constraint_name = rc.constraint_name
      WHERE kcu.table_name = $1 AND kcu.table_schema = $2
        AND kcu.position_in_unique_constraint IS NOT NULL
    `;
    const result = await this.query(sql, [table, schema || 'public']);
    
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
      SELECT routine_name, routine_definition
      FROM information_schema.routines
      WHERE routine_type = 'PROCEDURE' AND routine_schema = $1
    `;
    const result = await this.query(sql, [schema || 'public']);
    
    return result.rows.map(row => ({ name: row[0], parameters: [], definition: row[1] }));
  }

  async getFunctions(schema?: string): Promise<FunctionInfo[]> {
    const sql = `
      SELECT routine_name, data_type, routine_definition
      FROM information_schema.routines
      WHERE routine_type = 'FUNCTION' AND routine_schema = $1
    `;
    const result = await this.query(sql, [schema || 'public']);
    
    return result.rows.map(row => ({
      name: row[0],
      returnType: row[1],
      parameters: [],
      definition: row[2],
    }));
  }

  async executeProcedure(procedure: string, params?: any[]): Promise<any> {
    const paramList = params?.map((_, i) => `$${i + 1}`).join(', ') || '';
    const sql = `CALL ${procedure}(${paramList})`;
    return this.query(sql, params);
  }

  async executeFunction(func: string, params?: any[]): Promise<any> {
    const paramList = params?.map((_, i) => `$${i + 1}`).join(', ') || '';
    const sql = `SELECT ${func}(${paramList}) as result`;
    return this.query(sql, params);
  }

  async beginTransaction(): Promise<string> {
    if (!this.pool) throw new Error('Not connected');
    
    const client = await this.pool.connect();
    await client.query('BEGIN');
    
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.clients.set(transactionId, client);
    
    return transactionId;
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const client = this.clients.get(transactionId);
    if (!client) throw new Error('Transaction not found');
    
    await client.query('COMMIT');
    client.release();
    this.clients.delete(transactionId);
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const client = this.clients.get(transactionId);
    if (!client) throw new Error('Transaction not found');
    
    await client.query('ROLLBACK');
    client.release();
    this.clients.delete(transactionId);
  }

  async queryInTransaction(transactionId: string, sql: string, params?: any[]): Promise<QueryResult> {
    const client = this.clients.get(transactionId);
    if (!client) throw new Error('Transaction not found');
    
    const startTime = Date.now();
    const result = await client.query(sql, params);
    
    const columns = result.fields.map(f => ({ name: f.name, type: f.dataTypeID }));
    const rows = result.rows.map(row => Object.values(row));
    
    return this.formatQueryResult(columns, rows, startTime);
  }
}
