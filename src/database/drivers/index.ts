import { BaseDriver } from './BaseDriver';
import { MySQLDriver } from './MySQLDriver';
import { PostgreSQLDriver } from './PostgreSQLDriver';
import { SQLiteDriver } from './SQLiteDriver';
import { SQLServerDriver } from './SQLServerDriver';
import type { DatabaseConfig } from '@/types';

export class DriverFactory {
  static create(config: DatabaseConfig): BaseDriver {
    switch (config.type) {
      case 'mysql':
        return new MySQLDriver(config);
      case 'postgresql':
        return new PostgreSQLDriver(config);
      case 'sqlserver':
        return new SQLServerDriver(config);
      case 'oracle':
        throw new Error('Oracle driver not yet implemented');
      case 'sqlite':
        return new SQLiteDriver(config);
      default:
        throw new Error(`Unsupported database type: ${(config as any).type}`);
    }
  }
}
