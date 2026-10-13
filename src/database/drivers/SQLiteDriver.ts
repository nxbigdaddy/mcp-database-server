import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
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
import * as fs from 'fs';
import * as path from 'path';

const logger = createChildLogger('SQLiteDriver');

export class SQLiteDriver extends BaseDriver {
  private db: SqlJsDatabase | null = null;
  private transactions: Map<string, SqlJsDatabase> = new Map();

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    const SQL = await initSqlJs();
    const dbPath = this.config.database;

    if (!dbPath) {
      throw new Error('SQLite database path is required');
    }

    const fullPath = path.resolve(dbPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.connected = true;
    this.save();
    logger.info(`Connected to SQLite: ${fullPath}`);
  }

  private save(): void {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.config.database, buffer);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      this.connected = false;
      logger.info('Disconnected from SQLite');
    }
  }

  isConnected(): boolean {
    return this.connected && this.db !== null;
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.db) throw new Error('Not connected');

    const startTime = Date.now();
    try {
      const result = this.db.exec(sql, params || []);

      if (result.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTime: Date.now() - startTime,
        };
      }

      const columns = result[0].columns.map(name => ({ name, type: 'TEXT' }));
      const rows = result[0].values;

      return this.formatQueryResult(columns, rows, startTime);
    } catch (error: any) {
      logger.error('SQLite query error:', error.message, sql);
      throw error;
    }
  }

  async execute(sql: string, params?: any[]): Promise<{ rowCount: number; executionTime: number }> {
    if (!this.db) throw new Error('Not connected');

    const startTime = Date.now();
    try {
      this.db.run(sql, params || []);
      this.save();
      return {
        rowCount: this.db.getRowsModified(),
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('SQLite execute error:', error.message, sql);
      throw error;
    }
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    return [{ name: this.config.database }];
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const result = await this.query("SELECT name, 'table' as type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    return result.rows.map(row => ({ name: row[0], type: row[1] }));
  }

  async getViews(schema?: string): Promise<TableInfo[]> {
    const result = await this.query("SELECT name, 'view' as type FROM sqlite_master WHERE type='view' ORDER BY name");
    return result.rows.map(row => ({ name: row[0], type: row[1] }));
  }

  async getTableSchema(table: string, schema?: string): Promise<TableSchema> {
    const result = await this.query(`PRAGMA table_info(${table})`);
    const columns = result.rows.map(row => ({
      name: row[1],
      type: row[2],
      nullable: row[3] === 0,
      default: row[4],
      primaryKey: row[5] === 1,
    }));

    const primaryKey = columns.filter(c => c.primaryKey).map(c => c.name);
    const indexes = await this.getIndexes(table);
    const foreignKeys = await this.getForeignKeys(table);

    return { table, columns, primaryKey, indexes, foreignKeys };
  }

  async getIndexes(table: string, schema?: string): Promise<IndexInfo[]> {
    const result = await this.query(`PRAGMA index_list(${table})`);
    const indexes: IndexInfo[] = [];

    for (const row of result.rows) {
      const indexName = row[1];
      const unique = row[2] === 1;
      const indexInfo = await this.query(`PRAGMA index_info(${indexName})`);
      const columns = indexInfo.rows.map(r => r[2]);

      indexes.push({
        name: indexName,
        columns,
        unique,
        type: 'BTREE',
      });
    }

    return indexes;
  }

  async getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]> {
    const result = await this.query(`PRAGMA foreign_key_list(${table})`);
    return result.rows.map(row => ({
      column: row[3],
      refTable: row[2],
      refColumn: row[4],
      onDelete: row[6],
      onUpdate: row[7],
    }));
  }

  async getProcedures(schema?: string): Promise<ProcedureInfo[]> {
    return [];
  }

  async getFunctions(schema?: string): Promise<FunctionInfo[]> {
    return [];
  }

  async executeProcedure(procedure: string, params?: any[]): Promise<any> {
    throw new Error('SQLite does not support stored procedures');
  }

  async executeFunction(func: string, params?: any[]): Promise<any> {
    const paramList = params?.map(() => '?').join(', ') || '';
    const sql = `SELECT ${func}(${paramList}) as result`;
    return this.query(sql, params);
  }

  async beginTransaction(): Promise<string> {
    if (!this.db) throw new Error('Not connected');

    const SQL = await initSqlJs();
    const data = this.db.export();
    const snapshot = new SQL.Database(data);

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.transactions.set(transactionId, snapshot);

    return transactionId;
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const snapshot = this.transactions.get(transactionId);
    if (!snapshot) throw new Error('Transaction not found');

    snapshot.close();
    this.transactions.delete(transactionId);
    this.save();
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const snapshot = this.transactions.get(transactionId);
    if (!snapshot) throw new Error('Transaction not found');

    if (this.db) {
      this.db.close();
    }

    const SQL = await initSqlJs();
    const data = snapshot.export();
    this.db = new SQL.Database(data);

    snapshot.close();
    this.transactions.delete(transactionId);
  }

  async queryInTransaction(transactionId: string, sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.db) throw new Error('Not connected');
    return this.query(sql, params);
  }
}
