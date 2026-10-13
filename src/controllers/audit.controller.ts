import { Request, Response, NextFunction } from 'express';
import { auditLogRepository, settingsRepository } from '@/database/system/repositories';

export class AuditController {
  async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = '1',
        pageSize = '100',
        connectionId,
        status,
        sqlType,
        startDate,
        endDate,
        search,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const size = parseInt(pageSize as string, 10);

      const result = auditLogRepository.find({
        page: pageNum,
        pageSize: size,
        connectionId: connectionId as string,
        status: status as string,
        sqlType: sqlType as string,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string,
      });

      res.json({
        success: true,
        data: {
          logs: result.logs,
          pagination: {
            page: pageNum,
            pageSize: size,
            total: result.total,
            totalPages: Math.ceil(result.total / size),
          },
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getLog(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const logs = auditLogRepository.find({ page: 1, pageSize: 1 });
      
      const log = logs.logs.find(l => l.id === parseInt(id, 10));
      
      if (!log) {
        return res.status(404).json({
          success: false,
          error: { code: 'LOG_NOT_FOUND', message: 'Audit log not found' },
        });
      }

      res.json({ success: true, data: log });
    } catch (error: any) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const stats = auditLogRepository.getStats({
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }

  async exportLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { format = 'csv', startDate, endDate } = req.query;
      const { logs } = auditLogRepository.find({
        page: 1,
        pageSize: 100000,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.json"`);
        res.json(logs);
      } else {
        const headers = ['id', 'connection_id', 'connection_name', 'sql_text', 'sql_type', 'status', 'execution_time_ms', 'row_count', 'created_at'];
        const csvRows = [headers.join(',')];

        for (const log of logs) {
          const row = headers.map(h => {
            const value = (log as any)[h];
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value}"`;
            }
            return value;
          });
          csvRows.push(row.join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
        res.send(csvRows.join('\n'));
      }
    } catch (error: any) {
      next(error);
    }
  }

  async clearLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { beforeDate } = req.query;
      
      if (beforeDate) {
        const deleted = auditLogRepository.deleteBefore(beforeDate as string);
        res.json({ success: true, data: { deleted }, message: `Deleted ${deleted} logs before ${beforeDate}` });
      } else {
        const deleted = auditLogRepository.clear();
        res.json({ success: true, data: { deleted }, message: 'Cleared all audit logs' });
      }
    } catch (error: any) {
      next(error);
    }
  }
}

export class SettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = settingsRepository.findAll();
      res.json({ success: true, data: settings });
    } catch (error: any) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = req.body;
      settingsRepository.updateMany(settings);
      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: any) {
      next(error);
    }
  }

  async getSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const value = settingsRepository.findByKey(key);
      
      if (value === null) {
        return res.status(404).json({
          success: false,
          error: { code: 'SETTING_NOT_FOUND', message: 'Setting not found' },
        });
      }

      res.json({ success: true, data: { key, value } });
    } catch (error: any) {
      next(error);
    }
  }

  async updateSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      settingsRepository.update(key, value, description);
      res.json({ success: true, message: 'Setting updated successfully' });
    } catch (error: any) {
      next(error);
    }
  }
}

export class SystemController {
  async health(req: Request, res: Response, next: NextFunction) {
    try {
      const os = await import('os');
      const { connectionManager } = await import('@/database/ConnectionManager');
      const { systemDb } = await import('@/database/system');

      const db = systemDb.getDb();
      const dbSize = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get() as any;

      const connectionStatuses = connectionManager.getStatus();
      const connections: any = {};
      
      for (const status of connectionStatuses) {
        connections[status.name] = {
          status: status.connected ? 'connected' : 'disconnected',
          error: status.error,
        };
      }

      const memoryUsage = process.memoryUsage();

      res.json({
        success: true,
        data: {
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          uptime: process.uptime(),
          nodeVersion: process.version,
          database: {
            system: {
              status: 'connected',
              size: dbSize?.size || 0,
            },
            connections,
          },
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
            usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
          },
          system: {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
            freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
          },
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async version(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          version: process.env.npm_package_version || '1.0.0',
          buildDate: new Date().toISOString(),
          nodeVersion: process.version,
          mcpVersion: process.env.npm_package_dependencies_modelcontextprotocol_sdk || 'N/A',
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
export const settingsController = new SettingsController();
export const systemController = new SystemController();
