import initSqlJs, { type Database } from 'sql.js';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export class SystemDatabase {
  private db: Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = config.systemDbPath;
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();
    const dbDir = path.dirname(this.dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`Created database directory: ${dbDir}`);
    }

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
      logger.info(`Loaded existing system database: ${this.dbPath}`);
    } else {
      this.db = new SQL.Database();
      logger.info(`Created new system database: ${this.dbPath}`);
    }

    this.createTables();
    this.insertDefaultSettings();
    this.save();
    logger.info('System database schema initialized');
  }

  private save(): void {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }
  }

  private createTables(): void {
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        host TEXT,
        port INTEGER,
        database TEXT NOT NULL,
        username TEXT,
        password TEXT,
        ssl_enabled INTEGER DEFAULT 0,
        ssl_options TEXT,
        pool_min INTEGER DEFAULT 2,
        pool_max INTEGER DEFAULT 10,
        pool_idle_timeout INTEGER DEFAULT 30000,
        read_only INTEGER DEFAULT 0,
        sql_whitelist TEXT,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        connection_name TEXT NOT NULL,
        user_identifier TEXT,
        sql_text TEXT NOT NULL,
        sql_type TEXT NOT NULL,
        database_name TEXT,
        table_name TEXT,
        parameters TEXT,
        execution_time_ms INTEGER,
        row_count INTEGER,
        status TEXT NOT NULL,
        error_message TEXT,
        client_ip TEXT,
        client_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        sql_text TEXT NOT NULL,
        parameters TEXT,
        execution_time_ms INTEGER,
        row_count INTEGER,
        status TEXT NOT NULL,
        saved INTEGER DEFAULT 0,
        tags TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS saved_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        connection_id TEXT,
        sql_text TEXT NOT NULL,
        description TEXT,
        parameters TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_audit_connection ON audit_logs(connection_id)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_identifier)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs(status)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_audit_sql_type ON audit_logs(sql_type)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(name)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_connections_type ON connections(type)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_query_history_created ON query_history(created_at)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_query_history_connection ON query_history(connection_id)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_query_history_saved ON query_history(saved)`);
  }

  private insertDefaultSettings(): void {
    const defaultSettings = [
      ['audit_retention_days', '30', '审计日志保留天数'],
      ['max_query_rows', '10000', '单次查询最大返回行数'],
      ['default_query_limit', '100', '默认查询限制'],
      ['query_timeout_ms', '30000', '查询超时时间 (ms)'],
      ['enable_slow_query_log', 'true', '是否启用慢查询日志'],
      ['slow_query_threshold_ms', '1000', '慢查询阈值 (ms)'],
      ['web_ui_enabled', 'true', '是否启用 Web UI'],
      ['mcp_transport', 'sse', 'MCP 传输方式：sse|stdio'],
      ['allow_ddl', 'false', '是否允许 DDL 操作'],
      ['require_confirmation_delete', 'true', 'DELETE 操作是否需要确认'],
    ];

    const stmt = this.db!.prepare(`INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)`);
    for (const [key, value, description] of defaultSettings) {
      stmt.run([key, value, description]);
    }
    stmt.free();
  }

  getDb(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      logger.info('System database closed');
    }
  }
}

export const systemDb = new SystemDatabase();
