export interface DatabaseConfig {
  id?: string;
  name: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  sslEnabled?: boolean;
  sslOptions?: Record<string, any>;
  poolMin?: number;
  poolMax?: number;
  poolIdleTimeout?: number;
  readOnly?: boolean;
  sqlWhitelist?: string[];
  enabled?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type DatabaseType = 'mysql' | 'postgresql' | 'sqlserver' | 'oracle' | 'sqlite';

export interface QueryResult {
  columns: ColumnInfo[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
  truncated?: boolean;
}

export interface ColumnInfo {
  name: string;
  type: string;
  length?: number;
  nullable?: boolean;
  default?: any;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  comment?: string;
}

export interface TableInfo {
  name: string;
  type: string;
  rowCount?: number;
  size?: number;
  engine?: string;
  charset?: string;
  comment?: string;
}

export interface TableSchema {
  table: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
  size?: number;
}

export interface ForeignKeyInfo {
  column: string;
  refTable: string;
  refColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface AuditLog {
  id?: number;
  connectionId: string;
  connectionName: string;
  userIdentifier?: string;
  sqlText: string;
  sqlType: string;
  databaseName?: string;
  tableName?: string;
  parameters?: any;
  executionTimeMs?: number;
  rowCount?: number;
  status: 'success' | 'error';
  errorMessage?: string;
  clientIp?: string;
  clientType?: 'web_ui' | 'mcp_client';
  createdAt?: Date;
}

export interface SystemSettings {
  auditRetentionDays: number;
  maxQueryRows: number;
  defaultQueryLimit: number;
  queryTimeoutMs: number;
  enableSlowQueryLog: boolean;
  slowQueryThresholdMs: number;
  webUiEnabled: boolean;
  mcpTransport: 'sse' | 'stdio';
  allowDdl: boolean;
  requireConfirmationDelete: boolean;
}

export interface ConnectionPool {
  active: number;
  idle: number;
  total: number;
  waiting: number;
}

export interface ConnectionStatus {
  id: string;
  name: string;
  connected: boolean;
  error?: string;
  pool?: ConnectionPool;
  latency?: number;
}

export interface TransactionInfo {
  id: string;
  connectionId: string;
  createdAt: Date;
}

export interface ProcedureParameter {
  name: string;
  type: string;
  mode: 'IN' | 'OUT' | 'INOUT';
  value?: any;
}

export interface ProcedureInfo {
  name: string;
  parameters: ProcedureParameter[];
  definition?: string;
}

export interface FunctionInfo {
  name: string;
  returnType: string;
  parameters: ProcedureParameter[];
  definition?: string;
}

export interface DatabaseInfo {
  name: string;
  size?: number;
  charset?: string;
  collation?: string;
}
