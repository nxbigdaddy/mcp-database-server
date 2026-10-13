import { Request, Response, NextFunction } from 'express';
import { connectionRepository } from '@/database/system/repositories';
import { connectionManager } from '@/database/ConnectionManager';
import type { DatabaseConfig } from '@/types';

export class ConnectionsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const connections = connectionRepository.findAll();
      res.json({
        success: true,
        data: connections.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          host: c.host,
          port: c.port,
          database: c.database,
          pool_min: c.poolMin,
          pool_max: c.poolMax,
          read_only: c.readOnly,
          enabled: c.enabled,
          created_at: c.createdAt,
          updated_at: c.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const connection = connectionRepository.findById(id);
      
      if (!connection) {
        return res.status(404).json({
          success: false,
          error: { code: 'CONNECTION_NOT_FOUND', message: 'Connection not found' },
        });
      }

      const { password, ...safeConnection } = connection;
      res.json({ success: true, data: safeConnection });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const config: DatabaseConfig = req.body;
      
      const existing = connectionRepository.findByName(config.name);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: { code: 'CONNECTION_EXISTS', message: 'Connection name already exists' },
        });
      }

      const created = connectionRepository.create(config);
      
      if (config.enabled !== false) {
        try {
          await connectionManager.addConnection(config);
        } catch (error: any) {
          connectionRepository.delete(created.id!);
          throw error;
        }
      }

      res.status(201).json({
        success: true,
        data: { id: created.id, name: created.name, created_at: created.createdAt },
        message: 'Connection created successfully',
      });
    } catch (error: any) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updates: Partial<DatabaseConfig> = req.body;

      const existing = connectionRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { code: 'CONNECTION_NOT_FOUND', message: 'Connection not found' },
        });
      }

      connectionRepository.update(id, updates);
      
      if (connectionManager.getConnection(id)) {
        await connectionManager.removeConnection(id);
      }
      
      if (updates.enabled !== false) {
        const config = connectionRepository.findById(id)!;
        await connectionManager.addConnection(config);
      }

      res.json({ success: true, message: 'Connection updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const existing = connectionRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { code: 'CONNECTION_NOT_FOUND', message: 'Connection not found' },
        });
      }

      if (connectionManager.getConnection(id)) {
        await connectionManager.removeConnection(id);
      }

      connectionRepository.delete(id);
      res.json({ success: true, message: 'Connection deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async test(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      let config = connectionRepository.findById(id);
      if (!config) {
        config = connectionRepository.findByName(id);
      }

      if (!config) {
        return res.status(404).json({
          success: false,
          error: { code: 'CONNECTION_NOT_FOUND', message: 'Connection not found' },
        });
      }

      const result = await connectionManager.testConnection(config);
      
      res.json({
        success: result.connected,
        data: result,
        message: result.connected ? 'Connection successful' : 'Connection failed',
      });
    } catch (error: any) {
      next(error);
    }
  }

  async ping(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await connectionManager.getConnectionStatus(id);
      
      res.json({
        success: result.connected,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async resetPool(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (connectionManager.getConnection(id)) {
        await connectionManager.removeConnection(id);
      }
      
      const config = connectionRepository.findById(id);
      if (config && config.enabled !== false) {
        await connectionManager.addConnection(config);
      }

      res.json({ success: true, message: 'Connection pool reset successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const connectionsController = new ConnectionsController();
