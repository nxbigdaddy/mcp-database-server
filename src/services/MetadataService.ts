import { connectionManager } from '@/database/ConnectionManager';
import type { TableInfo, TableSchema, IndexInfo, ForeignKeyInfo, DatabaseInfo, ProcedureInfo, FunctionInfo } from '@/types';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('MetadataService');

export class MetadataService {
  async getDatabases(connectionId: string): Promise<DatabaseInfo[]> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.getDatabases();
  }

  async getTables(connectionId: string, database?: string, schema?: string): Promise<TableInfo[]> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.getTables(schema);
  }

  async getViews(connectionId: string, database?: string, schema?: string): Promise<TableInfo[]> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.getViews(schema);
  }

  async getTableSchema(connectionId: string, table: string, database?: string, schema?: string): Promise<TableSchema> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.getTableSchema(table, schema);
  }

  async getIndexes(connectionId: string, table: string, database?: string, schema?: string): Promise<IndexInfo[]> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.getIndexes(table, schema);
  }

  async getForeignKeys(connectionId: string, table: string, database?: string, schema?: string): Promise<ForeignKeyInfo[]> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.getForeignKeys(table, schema);
  }

  async getProcedures(connectionId: string, database?: string, schema?: string): Promise<ProcedureInfo[]> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.getProcedures(schema);
  }

  async getFunctions(connectionId: string, database?: string, schema?: string): Promise<FunctionInfo[]> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.getFunctions(schema);
  }

  async executeProcedure(connectionId: string, procedure: string, params?: any[]): Promise<any> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.executeProcedure(procedure, params);
  }

  async executeFunction(connectionId: string, func: string, params?: any[]): Promise<any> {
    const driver = connectionManager.getConnection(connectionId);
    if (!driver) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return driver.executeFunction(func, params);
  }
}

export const metadataService = new MetadataService();
