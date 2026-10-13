import { systemDb } from '@/database/system';
import { connectionRepository } from '@/database/system/repositories';
import type { DatabaseConfig } from '@/types';
import { logger } from '@/utils/logger';

export const defaultConnections: DatabaseConfig[] = [
  {
    name: 'PLM系统',
    type: 'sqlserver',
    host: '203.0.113.10',
    port: 1433,
    database: 'plm',
    username: 'sa',
    password: 'YOUR_PASSWORD',
    poolMin: 2,
    poolMax: 10,
    poolIdleTimeout: 30000,
    enabled: true,
  },
  {
    name: 'U8系统',
    type: 'sqlserver',
    host: '203.0.113.10',
    port: 1433,
    database: 'UFDATA_001_2020',
    username: 'sa',
    password: 'YOUR_PASSWORD',
    poolMin: 2,
    poolMax: 10,
    poolIdleTimeout: 30000,
    enabled: true,
  },
  {
    name: '示例服务商系统(QMS/WMS/SRM/MOM)',
    type: 'sqlserver',
    host: '203.0.113.10',
    port: 1433,
    database: 'zd_master',
    username: 'sa',
    password: 'YOUR_PASSWORD',
    poolMin: 2,
    poolMax: 10,
    poolIdleTimeout: 30000,
    enabled: true,
  },
  {
    name: 'OA系统',
    type: 'sqlserver',
    host: '203.0.113.10',
    port: 1433,
    database: 'ekp',
    username: 'sa',
    password: 'YOUR_PASSWORD',
    poolMin: 2,
    poolMax: 10,
    poolIdleTimeout: 30000,
    enabled: true,
  },
  {
    name: 'HR系统',
    type: 'sqlserver',
    host: '203.0.113.10',
    port: 62059,
    database: 'T9IMS',
    username: 'sa',
    password: 'YOUR_PASSWORD',
    poolMin: 2,
    poolMax: 10,
    poolIdleTimeout: 30000,
    enabled: true,
  },
];

export async function initDefaultConnections(): Promise<void> {
  await systemDb.init();
  
  const existing = connectionRepository.findAll();
  if (existing.length > 0) {
    logger.info('Connections already exist, skipping default initialization');
    return;
  }

  logger.info('Initializing default database connections...');
  
  for (const conn of defaultConnections) {
    try {
      connectionRepository.create(conn);
      logger.info(`Created connection: ${conn.name} (${conn.host}:${conn.port}/${conn.database})`);
    } catch (error: any) {
      logger.error(`Failed to create connection ${conn.name}: ${error.message}`);
    }
  }
  
  logger.info('Default connections initialization complete');
}
