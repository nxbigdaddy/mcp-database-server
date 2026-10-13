import { connectionManager } from '@/database/ConnectionManager';
import { auditLogRepository } from '@/database/system/repositories';
import { config } from '@/config';
import type { AuditLog } from '@/types';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('AuditService');

export class AuditService {
  async log(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    if (!config.auditEnabled) {
      return;
    }

    try {
      auditLogRepository.create(log);
      logger.debug(`Audit log created: ${log.sqlType} on ${log.connectionName}`);
    } catch (error) {
      logger.error('Failed to create audit log:', error);
    }
  }

  async logQuery(
    connectionId: string,
    connectionName: string,
    sql: string,
    sqlType: string,
    options: {
      databaseName?: string;
      tableName?: string;
      params?: any;
      executionTimeMs?: number;
      rowCount?: number;
      status: 'success' | 'error';
      errorMessage?: string;
      clientIp?: string;
      clientType?: 'web_ui' | 'mcp_client';
    }
  ): Promise<void> {
    await this.log({
      connectionId,
      connectionName,
      sqlText: sql,
      sqlType,
      databaseName: options.databaseName,
      tableName: options.tableName,
      parameters: options.params,
      executionTimeMs: options.executionTimeMs,
      rowCount: options.rowCount,
      status: options.status,
      errorMessage: options.errorMessage,
      clientIp: options.clientIp,
      clientType: options.clientType,
    });
  }

  async cleanup(): Promise<number> {
    const retentionDays = config.auditRetentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = auditLogRepository.deleteBefore(cutoffDate.toISOString());
    logger.info(`Cleaned up ${deleted} audit logs older than ${retentionDays} days`);
    
    return deleted;
  }
}

export const auditService = new AuditService();
