import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.string().transform(Number).default('3000'),
  MCP_PORT: z.string().transform(Number).default('3001'),
  SYSTEM_DB_PATH: z.string().default('./data/system.db'),
  WEB_UI_ENABLED: z.string().transform(Boolean).default('true'),
  MCP_TRANSPORT: z.enum(['sse', 'stdio']).default('sse'),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().optional(),
  AUDIT_ENABLED: z.string().transform(Boolean).default('true'),
  AUDIT_RETENTION_DAYS: z.string().transform(Number).default('30'),
  MAX_QUERY_ROWS: z.string().transform(Number).default('10000'),
  DEFAULT_QUERY_LIMIT: z.string().transform(Number).default('100'),
  QUERY_TIMEOUT_MS: z.string().transform(Number).default('30000'),
  API_KEY: YOUR_SECRET).optional(),
  IP_WHITELIST: z.string().optional(),
  ALLOW_DDL: z.string().transform(Boolean).default('false'),
  REQUIRE_DELETE_CONFIRMATION: z.string().transform(Boolean).default('true'),
  POOL_MIN: z.string().transform(Number).default('2'),
  POOL_MAX: z.string().transform(Number).default('10'),
  POOL_IDLE_TIMEOUT: z.string().transform(Number).default('30000'),
});

export type AppConfig = z.infer<typeof configSchema>;

class Config {
  private config: AppConfig;

  constructor() {
    const result = configSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Configuration validation error:', result.error.format());
      process.exit(1);
    }
    this.config = result.data;
  }

  get nodeEnv(): AppConfig['NODE_ENV'] {
    return this.config.NODE_ENV;
  }

  get port(): number {
    return this.config.PORT;
  }

  get mcpPort(): number {
    return this.config.MCP_PORT;
  }

  get systemDbPath(): string {
    return this.config.SYSTEM_DB_PATH;
  }

  get webUiEnabled(): boolean {
    return this.config.WEB_UI_ENABLED;
  }

  get mcpTransport(): 'sse' | 'stdio' {
    return this.config.MCP_TRANSPORT;
  }

  get encryptionKey(): string | undefined {
    return this.config.ENCRYPTION_KEY;
  }

  get logLevel(): string {
    return this.config.LOG_LEVEL;
  }

  get logFile(): string | undefined {
    return this.config.LOG_FILE;
  }

  get auditEnabled(): boolean {
    return this.config.AUDIT_ENABLED;
  }

  get auditRetentionDays(): number {
    return this.config.AUDIT_RETENTION_DAYS;
  }

  get maxQueryRows(): number {
    return this.config.MAX_QUERY_ROWS;
  }

  get defaultQueryLimit(): number {
    return this.config.DEFAULT_QUERY_LIMIT;
  }

  get queryTimeoutMs(): number {
    return this.config.QUERY_TIMEOUT_MS;
  }

  get apiKey(): string | undefined {
    return this.config.API_KEY;
  }

  get ipWhitelist(): string[] {
    return this.config.IP_WHITELIST?.split(',').filter(Boolean) || [];
  }

  get allowDdl(): boolean {
    return this.config.ALLOW_DDL;
  }

  get requireDeleteConfirmation(): boolean {
    return this.config.REQUIRE_DELETE_CONFIRMATION;
  }

  get poolMin(): number {
    return this.config.POOL_MIN;
  }

  get poolMax(): number {
    return this.config.POOL_MAX;
  }

  get poolIdleTimeout(): number {
    return this.config.POOL_IDLE_TIMEOUT;
  }

  getAll(): AppConfig {
    return { ...this.config };
  }
}

export const config = new Config();
