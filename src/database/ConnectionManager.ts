import { BaseDriver } from './drivers/BaseDriver';
import { DriverFactory } from './drivers';
import type { DatabaseConfig, ConnectionStatus } from '@/types';
import { connectionRepository } from './system/repositories';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('ConnectionManager');

export class ConnectionManager {
  private connections: Map<string, BaseDriver> = new Map();
  private configs: Map<string, DatabaseConfig> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    const configs = connectionRepository.findAll();
    
    for (const config of configs) {
      if (config.enabled !== false) {
        try {
          await this.addConnection(config);
        } catch (error) {
          logger.error(`Failed to initialize connection ${config.name}:`, error);
        }
      }
    }

    this.startHealthCheck();
    logger.info(`ConnectionManager initialized with ${this.connections.size} connections`);
  }

  async addConnection(config: DatabaseConfig): Promise<void> {
    const key = config.id || config.name;
    
    if (this.connections.has(key)) {
      await this.removeConnection(key);
    }

    const driver = DriverFactory.create(config);
    await driver.connect();
    
    this.connections.set(key, driver);
    this.configs.set(key, config);
    
    logger.info(`Added connection: ${config.name}`);
  }

  async removeConnection(key: string): Promise<void> {
    const driver = this.connections.get(key);
    if (driver) {
      await driver.disconnect();
      this.connections.delete(key);
      this.configs.delete(key);
      logger.info(`Removed connection: ${key}`);
    }
  }

  getConnection(key: string): BaseDriver | undefined {
    return this.connections.get(key);
  }

  getConnectionConfig(key: string): DatabaseConfig | undefined {
    return this.configs.get(key);
  }

  async testConnection(config: DatabaseConfig): Promise<{ connected: boolean; latency?: number; error?: string }> {
    const driver = DriverFactory.create(config);
    
    try {
      await driver.connect();
      const latency = await driver.ping();
      await driver.disconnect();
      
      return { connected: true, latency };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }

  getStatus(): ConnectionStatus[] {
    const statuses: ConnectionStatus[] = [];
    
    for (const [key, driver] of this.connections.entries()) {
      const config = this.configs.get(key);
      statuses.push({
        id: key,
        name: config?.name || key,
        connected: driver.isConnected(),
      });
    }
    
    return statuses;
  }

  async getConnectionStatus(key: string): Promise<{ connected: boolean; latency?: number; error?: string }> {
    const driver = this.connections.get(key);
    if (!driver) {
      return { connected: false, error: 'Connection not found' };
    }

    try {
      const latency = await driver.ping();
      return { connected: driver.isConnected(), latency };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }

  async reloadConnections(): Promise<void> {
    for (const key of this.connections.keys()) {
      await this.removeConnection(key);
    }

    await this.initialize();
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const [key, driver] of this.connections.entries()) {
        if (!driver.isConnected()) {
          logger.warn(`Connection ${key} is not connected, attempting to reconnect...`);
          try {
            await driver.connect();
          } catch (error) {
            logger.error(`Failed to reconnect ${key}:`, error);
          }
        }
      }
    }, 60000);

    logger.info('Health check started (interval: 60s)');
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    for (const [key, driver] of this.connections.entries()) {
      try {
        await driver.disconnect();
      } catch (error) {
        logger.error(`Error disconnecting ${key}:`, error);
      }
    }

    this.connections.clear();
    this.configs.clear();
    
    logger.info('ConnectionManager shutdown complete');
  }
}

export const connectionManager = new ConnectionManager();
