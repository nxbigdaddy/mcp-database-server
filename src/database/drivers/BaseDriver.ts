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

export abstract class BaseDriver {
  protected config: DatabaseConfig;
  protected connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;

  abstract query(sql: string, params?: any[]): Promise<QueryResult>;
  abstract execute(sql: string, params?: any[]): Promise<{ rowCount: number; executionTime: number }>;

  abstract getDatabases(): Promise<DatabaseInfo[]>;
  abstract getTables(schema?: string): Promise<TableInfo[]>;
  abstract getViews(schema?: string): Promise<TableInfo[]>;
  abstract getTableSchema(table: string, schema?: string): Promise<TableSchema>;
  abstract getIndexes(table: string, schema?: string): Promise<IndexInfo[]>;
  abstract getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]>;
  
  abstract getProcedures(schema?: string): Promise<ProcedureInfo[]>;
  abstract getFunctions(schema?: string): Promise<FunctionInfo[]>;
  abstract executeProcedure(procedure: string, params?: any[]): Promise<any>;
  abstract executeFunction(func: string, params?: any[]): Promise<any>;

  abstract beginTransaction(): Promise<string>;
  abstract commitTransaction(transactionId: string): Promise<void>;
  abstract rollbackTransaction(transactionId: string): Promise<void>;
  abstract queryInTransaction(transactionId: string, sql: string, params?: any[]): Promise<QueryResult>;

  async ping(): Promise<number> {
    const start = Date.now();
    await this.query('SELECT 1');
    return Date.now() - start;
  }

  protected formatQueryResult(columns: any[], rows: any[], startTime: number): QueryResult {
    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTime: Date.now() - startTime,
    };
  }
}
