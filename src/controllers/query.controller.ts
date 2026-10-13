import { Request, Response, NextFunction } from 'express';
import { queryExecutor } from '@/services/QueryExecutor';
import { metadataService } from '@/services/MetadataService';

export class QueryController {
  async execute(req: Request, res: Response, next: NextFunction) {
    try {
      const { connection, sql, params, limit, offset } = req.body;

      if (!connection || !sql) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'connection and sql are required' },
        });
      }

      const result = await queryExecutor.execute(connection, sql, params, {
        limit,
        offset,
        clientIp: req.ip,
        clientType: 'web_ui',
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      next(error);
    }
  }

  async executeUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const { connection, sql, params } = req.body;

      if (!connection || !sql) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'connection and sql are required' },
        });
      }

      const result = await queryExecutor.executeUpdate(connection, sql, params, {
        clientIp: req.ip,
        clientType: 'web_ui',
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      next(error);
    }
  }

  async executeBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { connection, statements, transaction } = req.body;

      if (!connection || !statements || !Array.isArray(statements)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'connection and statements array are required' },
        });
      }

      if (transaction) {
        const result = await queryExecutor.executeInTransaction(connection, statements);
        res.json({ success: true, data: result });
      } else {
        const results = [];
        for (const { sql, params } of statements) {
          try {
            const result = await queryExecutor.executeUpdate(connection, sql, params);
            results.push({ success: true, ...result });
          } catch (error: any) {
            results.push({ success: false, error: error.message });
          }
        }
        res.json({ success: true, data: { results } });
      }
    } catch (error: any) {
      next(error);
    }
  }

  async explain(req: Request, res: Response, next: NextFunction) {
    try {
      const { connection, sql, params } = req.body;

      if (!connection || !sql) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'connection and sql are required' },
        });
      }

      const explainSql = `EXPLAIN ${sql}`;
      const result = await queryExecutor.execute(connection, explainSql, params, {
        clientIp: req.ip,
        clientType: 'web_ui',
      });

      res.json({ success: true, data: { plan: result.rows } });
    } catch (error: any) {
      next(error);
    }
  }

  async beginTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { connection } = req.body;

      if (!connection) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'connection is required' },
        });
      }

      const transactionId = await queryExecutor.beginTransaction(connection);
      res.json({ success: true, data: { transactionId } });
    } catch (error: any) {
      next(error);
    }
  }

  async commitTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { connection, transactionId } = req.body;

      if (!connection || !transactionId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'connection and transactionId are required' },
        });
      }

      await queryExecutor.commitTransaction(connection, transactionId);
      res.json({ success: true, message: 'Transaction committed successfully' });
    } catch (error: any) {
      next(error);
    }
  }

  async rollbackTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { connection, transactionId } = req.body;

      if (!connection || !transactionId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'connection and transactionId are required' },
        });
      }

      await queryExecutor.rollbackTransaction(connection, transactionId);
      res.json({ success: true, message: 'Transaction rolled back successfully' });
    } catch (error: any) {
      next(error);
    }
  }
}

export class MetadataController {
  async getDatabases(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId } = req.params;
      const databases = await metadataService.getDatabases(connectionId);
      res.json({ success: true, data: databases });
    } catch (error: any) {
      next(error);
    }
  }

  async getTables(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId } = req.params;
      const { database, schema } = req.query;
      const tables = await metadataService.getTables(connectionId, database as string, schema as string);
      res.json({ success: true, data: tables });
    } catch (error: any) {
      next(error);
    }
  }

  async getViews(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId } = req.params;
      const { database, schema } = req.query;
      const views = await metadataService.getViews(connectionId, database as string, schema as string);
      res.json({ success: true, data: views });
    } catch (error: any) {
      next(error);
    }
  }

  async getSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId, table } = req.params;
      const { database, schema } = req.query;
      const tableSchema = await metadataService.getTableSchema(connectionId, table, database as string, schema as string);
      res.json({ success: true, data: tableSchema });
    } catch (error: any) {
      next(error);
    }
  }

  async getIndexes(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId, table } = req.params;
      const { database, schema } = req.query;
      const indexes = await metadataService.getIndexes(connectionId, table, database as string, schema as string);
      res.json({ success: true, data: indexes });
    } catch (error: any) {
      next(error);
    }
  }

  async getForeignKeys(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId, table } = req.params;
      const { database, schema } = req.query;
      const foreignKeys = await metadataService.getForeignKeys(connectionId, table, database as string, schema as string);
      res.json({ success: true, data: foreignKeys });
    } catch (error: any) {
      next(error);
    }
  }

  async getProcedures(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId } = req.params;
      const { database, schema } = req.query;
      const procedures = await metadataService.getProcedures(connectionId, database as string, schema as string);
      res.json({ success: true, data: procedures });
    } catch (error: any) {
      next(error);
    }
  }

  async getFunctions(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId } = req.params;
      const { database, schema } = req.query;
      const functions = await metadataService.getFunctions(connectionId, database as string, schema as string);
      res.json({ success: true, data: functions });
    } catch (error: any) {
      next(error);
    }
  }
}

export class DataController {
  async getTableData(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId, table } = req.params;
      const { database, page = '1', pageSize = '100', sort, order = 'ASC' } = req.query;

      const pageNum = parseInt(page as string, 10);
      const size = parseInt(pageSize as string, 10);
      const offset = (pageNum - 1) * size;

      let sql = `SELECT * FROM ${table}`;
      const params: any[] = [];

      if (sort) {
        sql += ` ORDER BY ${sort} ${order}`;
      }

      sql += ' LIMIT ? OFFSET ?';
      params.push(size, offset);

      const result = await queryExecutor.execute(connectionId, sql, params, {
        clientIp: req.ip,
        clientType: 'web_ui',
      });

      const countSql = `SELECT COUNT(*) as count FROM ${table}`;
      const countResult = await queryExecutor.execute(connectionId, countSql, [], {
        clientIp: req.ip,
        clientType: 'web_ui',
      });

      const total = countResult.rows[0]?.[0] || 0;

      res.json({
        success: true,
        data: {
          columns: result.columns,
          rows: result.rows,
          pagination: {
            page: pageNum,
            pageSize: size,
            total,
            totalPages: Math.ceil(total / size),
          },
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async insertData(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId, table } = req.params;
      const { database, data } = req.body;

      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = columns.map(() => '?').join(', ');

      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      const result = await queryExecutor.executeUpdate(connectionId, sql, values, {
        clientIp: req.ip,
        clientType: 'web_ui',
      });

      res.status(201).json({
        success: true,
        data: { rowCount: result.rowCount },
        message: 'Data inserted successfully',
      });
    } catch (error: any) {
      next(error);
    }
  }

  async updateData(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId, table, id } = req.params;
      const { database, data } = req.body;

      const columns = Object.keys(data);
      const values = Object.values(data);
      const setClause = columns.map(col => `${col} = ?`).join(', ');

      const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
      const result = await queryExecutor.executeUpdate(connectionId, sql, [...values, id], {
        clientIp: req.ip,
        clientType: 'web_ui',
      });

      res.json({
        success: true,
        data: { rowCount: result.rowCount },
        message: 'Data updated successfully',
      });
    } catch (error: any) {
      next(error);
    }
  }

  async deleteData(req: Request, res: Response, next: NextFunction) {
    try {
      const { connectionId, table, id } = req.params;
      const { database } = req.query;

      const sql = `DELETE FROM ${table} WHERE id = ?`;
      const result = await queryExecutor.executeUpdate(connectionId, sql, [id], {
        clientIp: req.ip,
        clientType: 'web_ui',
      });

      res.json({
        success: true,
        data: { rowCount: result.rowCount },
        message: 'Data deleted successfully',
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const queryController = new QueryController();
export const metadataController = new MetadataController();
export const dataController = new DataController();
