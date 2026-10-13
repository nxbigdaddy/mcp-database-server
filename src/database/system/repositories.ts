import { systemDb } from '.';
import type { DatabaseConfig, SystemSettings, AuditLog } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { encryptionService } from '@/services/EncryptionService';
import type { Database } from 'sql.js';

function rowToObject(row: any[], columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

export class ConnectionRepository {
  private db(): Database { return systemDb.getDb(); }

  findAll(): DatabaseConfig[] {
    const result = this.db().exec('SELECT * FROM connections ORDER BY created_at DESC');
    if (!result.length) return [];
    const columns = result[0].columns;
    return result[0].values.map((row: any[]) => {
      const r = rowToObject(row, columns);
      return {
        ...r,
        ssl_enabled: Boolean(r.ssl_enabled),
        read_only: Boolean(r.read_only),
        enabled: Boolean(r.enabled),
        sql_whitelist: r.sql_whitelist ? JSON.parse(r.sql_whitelist) : undefined,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
      } as unknown as DatabaseConfig;
    });
  }

  findById(id: string): DatabaseConfig | null {
    const result = this.db().exec(`SELECT * FROM connections WHERE id = '${id.replace(/'/g, "''")}'`);
    if (!result.length || !result[0].values.length) return null;
    const r = rowToObject(result[0].values[0], result[0].columns);
    return {
      ...r,
      ssl_enabled: Boolean(r.ssl_enabled),
      read_only: Boolean(r.read_only),
      enabled: Boolean(r.enabled),
      sql_whitelist: r.sql_whitelist ? JSON.parse(r.sql_whitelist) : undefined,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    } as unknown as DatabaseConfig;
  }

  findByName(name: string): DatabaseConfig | null {
    const result = this.db().exec(`SELECT * FROM connections WHERE name = '${name.replace(/'/g, "''")}'`);
    if (!result.length || !result[0].values.length) return null;
    const r = rowToObject(result[0].values[0], result[0].columns);
    return {
      ...r,
      ssl_enabled: Boolean(r.ssl_enabled),
      read_only: Boolean(r.read_only),
      enabled: Boolean(r.enabled),
      sql_whitelist: r.sql_whitelist ? JSON.parse(r.sql_whitelist) : undefined,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    } as unknown as DatabaseConfig;
  }

  create(config: DatabaseConfig): DatabaseConfig {
    const id = uuidv4();
    const encryptedPassword = config.password ? encryptionService.encrypt(config.password) : null;
    const db = this.db();
    db.run(`INSERT INTO connections (id, name, type, host, port, database, username, password, ssl_enabled, ssl_options, pool_min, pool_max, pool_idle_timeout, read_only, sql_whitelist, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, config.name, config.type, config.host, config.port, config.database, config.username, encryptedPassword, config.sslEnabled ? 1 : 0, config.sslOptions ? JSON.stringify(config.sslOptions) : null, config.poolMin ?? 2, config.poolMax ?? 10, config.poolIdleTimeout ?? 30000, config.readOnly ? 1 : 0, config.sqlWhitelist ? JSON.stringify(config.sqlWhitelist) : null, config.enabled !== false ? 1 : 0]);
    systemDb['save']();
    return { ...config, id, createdAt: new Date(), updatedAt: new Date() };
  }

  update(id: string, updates: Partial<DatabaseConfig>): boolean {
    const fields: string[] = [];
    const values: any[] = [];
    const safeId = id.replace(/'/g, "''");

    const fieldMap: Record<string, any> = {
      name: updates.name,
      type: updates.type,
      host: updates.host,
      port: updates.port,
      database: updates.database,
      username: updates.username,
      password: YOUR_PASSWORD !== undefined ? (updates.password ? encryptionService.encrypt(updates.password) : null) : undefined,
      ssl_enabled: updates.sslEnabled !== undefined ? (updates.sslEnabled ? 1 : 0) : undefined,
      ssl_options: updates.sslOptions !== undefined ? (updates.sslOptions ? JSON.stringify(updates.sslOptions) : null) : undefined,
      pool_min: updates.poolMin,
      pool_max: updates.poolMax,
      pool_idle_timeout: updates.poolIdleTimeout,
      read_only: updates.readOnly !== undefined ? (updates.readOnly ? 1 : 0) : undefined,
      sql_whitelist: updates.sqlWhitelist !== undefined ? (updates.sqlWhitelist ? JSON.stringify(updates.sqlWhitelist) : null) : undefined,
      enabled: updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : undefined,
    };

    for (const [field, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${field} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return false;
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(safeId);

    this.db().run(`UPDATE connections SET ${fields.join(', ')} WHERE id = ?`, values);
    systemDb['save']();
    return true;
  }

  delete(id: string): boolean {
    this.db().run(`DELETE FROM connections WHERE id = ?`, [id]);
    systemDb['save']();
    return true;
  }
}

export class AuditLogRepository {
  private db(): Database { return systemDb.getDb(); }

  create(log: AuditLog): number {
    this.db().run(`INSERT INTO audit_logs (connection_id, connection_name, user_identifier, sql_text, sql_type, database_name, table_name, parameters, execution_time_ms, row_count, status, error_message, client_ip, client_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [log.connectionId, log.connectionName, log.userIdentifier, log.sqlText, log.sqlType, log.databaseName, log.tableName, log.parameters ? JSON.stringify(log.parameters) : null, log.executionTimeMs, log.rowCount, log.status, log.errorMessage, log.clientIp, log.clientType]);
    systemDb['save']();
    return 0;
  }

  find(options: { page?: number; pageSize?: number; connectionId?: string; status?: string; sqlType?: string; startDate?: string; endDate?: string; search?: string }): { logs: AuditLog[]; total: number } {
    const { page = 1, pageSize = 100, ...filters } = options;
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = [];
    const values: any[] = [];

    if (filters.connectionId) { whereClauses.push('connection_id = ?'); values.push(filters.connectionId); }
    if (filters.status) { whereClauses.push('status = ?'); values.push(filters.status); }
    if (filters.sqlType) { whereClauses.push('sql_type = ?'); values.push(filters.sqlType); }
    if (filters.startDate) { whereClauses.push('created_at >= ?'); values.push(filters.startDate); }
    if (filters.endDate) { whereClauses.push('created_at <= ?'); values.push(filters.endDate); }
    if (filters.search) { whereClauses.push('(sql_text LIKE ? OR connection_name LIKE ?)'); values.push(`%${filters.search}%`, `%${filters.search}%`); }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = this.db().exec(`SELECT COUNT(*) as count FROM audit_logs ${whereClause}`, values);
    const total = countResult.length ? (countResult[0].values[0][0] as number) : 0;

    const logsResult = this.db().exec(`SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, pageSize, offset]);
    let logs: AuditLog[] = [];
    if (logsResult.length) {
      const columns = logsResult[0].columns;
      logs = logsResult[0].values.map((row: any[]) => {
        const r = rowToObject(row, columns);
        return {
          id: r.id,
          connectionId: r.connection_id,
          connectionName: r.connection_name,
          userIdentifier: r.user_identifier,
          sqlText: r.sql_text,
          sqlType: r.sql_type,
          databaseName: r.database_name,
          tableName: r.table_name,
          parameters: r.parameters ? JSON.parse(r.parameters) : null,
          executionTimeMs: r.execution_time_ms,
          rowCount: r.row_count,
          status: r.status,
          errorMessage: r.error_message,
          clientIp: r.client_ip,
          clientType: r.client_type,
          createdAt: new Date(r.created_at),
        } as unknown as AuditLog;
      });
    }

    return { logs, total };
  }

  getStats(options: { startDate?: string; endDate?: string } = {}): any {
    const { startDate, endDate } = options;
    const whereClauses: string[] = [];
    const values: any[] = [];

    if (startDate) { whereClauses.push('created_at >= ?'); values.push(startDate); }
    if (endDate) { whereClauses.push('created_at <= ?'); values.push(endDate); }
    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const whereAnd = whereClauses.length > 0 ? `${where} AND` : 'WHERE';

    const totalResult = this.db().exec(`SELECT COUNT(*) FROM audit_logs ${where}`, values);
    const totalQueries = totalResult.length ? (totalResult[0].values[0][0] as number) : 0;

    const successResult = this.db().exec(`SELECT COUNT(*) FROM audit_logs ${whereAnd} status = 'success'`, values);
    const successQueries = successResult.length ? (successResult[0].values[0][0] as number) : 0;
    const errorQueries = totalQueries - successQueries;

    const avgResult = this.db().exec(`SELECT AVG(execution_time_ms) FROM audit_logs ${whereAnd} execution_time_ms IS NOT NULL`, values);
    const avgExecutionTime = avgResult.length && avgResult[0].values[0][0] ? (avgResult[0].values[0][0] as number) : 0;

    const slowResult = this.db().exec(`SELECT COUNT(*) FROM audit_logs ${whereAnd} execution_time_ms > 1000`, values);
    const slowQueries = slowResult.length ? (slowResult[0].values[0][0] as number) : 0;

    const byTypeResult = this.db().exec(`SELECT sql_type, COUNT(*) FROM audit_logs ${where} GROUP BY sql_type`, values);
    const queriesByType: Record<string, number> = {};
    if (byTypeResult.length) {
      byTypeResult[0].values.forEach((row: any[]) => { queriesByType[row[0] as string] = row[1] as number; });
    }

    const byConnResult = this.db().exec(`SELECT connection_name, COUNT(*) FROM audit_logs ${where} GROUP BY connection_name ORDER BY COUNT(*) DESC LIMIT 10`, values);
    const queriesByConnection: Record<string, number> = {};
    if (byConnResult.length) {
      byConnResult[0].values.forEach((row: any[]) => { queriesByConnection[row[0] as string] = row[1] as number; });
    }

    const topSlowResult = this.db().exec(`SELECT sql_text, AVG(execution_time_ms), COUNT(*) FROM audit_logs ${whereAnd} execution_time_ms IS NOT NULL GROUP BY sql_text ORDER BY AVG(execution_time_ms) DESC LIMIT 10`, values);
    const topSlowQueries: any[] = [];
    if (topSlowResult.length) {
      topSlowResult[0].values.forEach((row: any[]) => {
        topSlowQueries.push({ sql: row[0], avgTime: Math.round(row[1] as number), count: row[2] });
      });
    }

    return { totalQueries, successQueries, errorQueries, avgExecutionTime: Math.round(avgExecutionTime * 100) / 100, slowQueries, queriesByType, queriesByConnection, topSlowQueries };
  }

  deleteBefore(beforeDate: string): number {
    this.db().run('DELETE FROM audit_logs WHERE created_at < ?', [beforeDate]);
    systemDb['save']();
    return 0;
  }

  clear(): number {
    this.db().run('DELETE FROM audit_logs');
    systemDb['save']();
    return 0;
  }
}

export class SettingsRepository {
  private db(): Database { return systemDb.getDb(); }

  findAll(): SystemSettings {
    const result = this.db().exec('SELECT * FROM settings');
    const settings: any = {};
    if (result.length) {
      const columns = result[0].columns;
      result[0].values.forEach((row: any[]) => {
        const r = rowToObject(row, columns);
        let value: any = r.value;
        if (value === 'true' || value === 'false') value = value === 'true';
        else if (/^\d+$/.test(value)) value = parseInt(value, 10);
        settings[r.key] = value;
      });
    }
    return settings as unknown as SystemSettings;
  }

  findByKey(key: string): any {
    const result = this.db().exec(`SELECT * FROM settings WHERE key = '${key.replace(/'/g, "''")}'`);
    if (!result.length || !result[0].values.length) return null;
    let value = result[0].values[0][1];
    if (value === 'true' || value === 'false') value = value === 'true';
    else if (/^\d+$/.test(String(value))) value = parseInt(value as string, 10);
    return value;
  }

  update(key: string, value: any, description?: string): void {
    this.db().run(`INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`, [key, String(value), description]);
    systemDb['save']();
  }

  updateMany(settings: Partial<SystemSettings>): void {
    for (const [key, value] of Object.entries(settings)) {
      this.update(key, value);
    }
  }
}

export const connectionRepository = new ConnectionRepository();
export const auditLogRepository = new AuditLogRepository();
export const settingsRepository = new SettingsRepository();
