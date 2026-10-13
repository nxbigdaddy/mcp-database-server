import { connectionManager } from '@/database/ConnectionManager';
import { auditService } from './AuditService';
import { config } from '@/config';
import type { QueryResult } from '@/types';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('QueryExecutor');

export class QueryExecutor {
  async execute(
    connectionId: string,
    sql: string,
    params?: any[],
    options?: {
      limit?: number;
      offset?: number;
      timeoutMs?: number;
      clientIp?: string;
      clientType?: 'web_ui' | 'mcp_client';
    }
  ): Promise<QueryResult> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const connectionConfig = connectionManager.getConnectionConfig(connectionId);
    const startTime = Date.now();

    try {
      let finalSql = sql;
      let finalParams = params;

      if (this.isSelectQuery(sql)) {
        const limit = options?.limit ?? config.defaultQueryLimit;
        const maxLimit = config.maxQueryRows;
        
        if (!this.hasLimit(sql)) {
          finalSql = `${sql} LIMIT ?`;
          finalParams = [...(params || []), Math.min(limit, maxLimit)];
        }
      }

      const timeout = options?.timeoutMs ?? config.queryTimeoutMs;
      const result = await Promise.race([
        driver.query(finalSql, finalParams),
        this.timeout(timeout),
      ]);

      const executionTime = Date.now() - startTime;

      if (connectionConfig) {
        await auditService.logQuery(connectionId, connectionConfig.name, sql, this.getSqlType(sql), {
          params,
          executionTimeMs: executionTime,
          rowCount: result.rowCount,
          status: 'success',
          clientIp: options?.clientIp,
          clientType: options?.clientType,
        });
      }

      if (result.executionTime > config.queryTimeoutMs / 2) {
        logger.warn(`Slow query detected: ${executionTime}ms`, sql);
      }

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (connectionConfig) {
        await auditService.logQuery(connectionId, connectionConfig.name, sql, this.getSqlType(sql), {
          params,
          executionTimeMs: executionTime,
          status: 'error',
          errorMessage: error.message,
          clientIp: options?.clientIp,
          clientType: options?.clientType,
        });
      }

      throw error;
    }
  }

  async executeUpdate(
    connectionId: string,
    sql: string,
    params?: any[],
    options?: {
      clientIp?: string;
      clientType?: 'web_ui' | 'mcp_client';
    }
  ): Promise<{ rowCount: number; executionTime: number }> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const connectionConfig = connectionManager.getConnectionConfig(connectionId);
    const startTime = Date.now();

    try {
      const result = await driver.execute(sql, params);
      const executionTime = Date.now() - startTime;

      if (connectionConfig) {
        await auditService.logQuery(connectionId, connectionConfig.name, sql, this.getSqlType(sql), {
          params,
          executionTimeMs: executionTime,
          rowCount: result.rowCount,
          status: 'success',
          clientIp: options?.clientIp,
          clientType: options?.clientType,
        });
      }

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (connectionConfig) {
        await auditService.logQuery(connectionId, connectionConfig.name, sql, this.getSqlType(sql), {
          params,
          executionTimeMs: executionTime,
          status: 'error',
          errorMessage: error.message,
          clientIp: options?.clientIp,
          clientType: options?.clientType,
        });
      }

      throw error;
    }
  }

  async executeInTransaction(
    connectionId: string,
    statements: { sql: string; params?: any[] }[]
  ): Promise<{ results: QueryResult[]; executionTime: number }> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const connectionConfig = connectionManager.getConnectionConfig(connectionId);
    const startTime = Date.now();
    let transactionId: string | null = null;

    try {
      transactionId = await driver.beginTransaction();
      const results: QueryResult[] = [];

      for (const { sql, params } of statements) {
        const result = await driver.queryInTransaction(transactionId, sql, params);
        results.push(result);
      }

      await driver.commitTransaction(transactionId);
      const executionTime = Date.now() - startTime;

      if (connectionConfig) {
        await auditService.logQuery(connectionId, connectionConfig.name, 'TRANSACTION', 'TRANSACTION', {
          executionTimeMs: executionTime,
          rowCount: results.reduce((sum, r) => sum + r.rowCount, 0),
          status: 'success',
          clientType: 'web_ui',
        });
      }

      return { results, executionTime };
    } catch (error: any) {
      if (transactionId) {
        try {
          await driver.rollbackTransaction(transactionId);
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction:', rollbackError);
        }
      }

      const executionTime = Date.now() - startTime;

      if (connectionConfig) {
        await auditService.logQuery(connectionId, connectionConfig.name, 'TRANSACTION', 'TRANSACTION', {
          executionTimeMs: executionTime,
          status: 'error',
          errorMessage: error.message,
          clientType: 'web_ui',
        });
      }

      throw error;
    }
  }

  async beginTransaction(connectionId: string): Promise<string> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.beginTransaction();
  }

  async commitTransaction(connectionId: string, transactionId: string): Promise<void> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    await driver.commitTransaction(transactionId);
  }

  async rollbackTransaction(connectionId: string, transactionId: string): Promise<void> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    await driver.rollbackTransaction(transactionId);
  }

  private isSelectQuery(sql: string): boolean {
    return /^\s*SELECT/i.test(sql.trim());
  }

  private hasLimit(sql: string): boolean {
    return /\bLIMIT\b/i.test(sql);
  }

  private getSqlType(sql: string): string {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    if (trimmed.startsWith('CREATE')) return 'DDL';
    if (trimmed.startsWith('ALTER')) return 'DDL';
    if (trimmed.startsWith('DROP')) return 'DDL';
    if (trimmed.startsWith('CALL')) return 'PROCEDURE';
    return 'OTHER';
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms);
    });
  }
}

export const queryExecutor = new QueryExecutor();
