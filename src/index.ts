import express from 'express';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { systemDb } from '@/database/system';
import { connectionManager } from '@/database/ConnectionManager';
import { mcpServer } from '@/mcp/server';
import { createApp } from '@/app';
import { initDefaultConnections } from '@/database/seed';

async function bootstrap() {
  logger.info('Starting MCP Database Server...');

  try {
    await systemDb.init();
    logger.info('System database initialized');

    await initDefaultConnections();

    await connectionManager.initialize();
    logger.info('Connection manager initialized');

    const app = createApp();

    const httpServer = app.listen(config.port, () => {
      logger.info(`HTTP Server listening on port ${config.port}`);
      logger.info(`Web UI: http://localhost:${config.port}`);
      logger.info(`API: http://localhost:${config.port}/api`);
    });

    if (config.mcpTransport === 'sse') {
      const mcpApp = express();
      mcpApp.post('/messages', async (req, res) => {
        await mcpServer.handleMessage(req, res);
      });

      mcpApp.get('/sse', async (req, res) => {
        await mcpServer.runSSE(req, res);
      });

      mcpApp.listen(config.mcpPort, () => {
        logger.info(`MCP SSE Server listening on port ${config.mcpPort}`);
        logger.info(`MCP SSE Endpoint: http://localhost:${config.mcpPort}/sse`);
      });
    }

    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await connectionManager.shutdown();
      await mcpServer.shutdown();
      systemDb.close();
      httpServer.close(() => {
        logger.info('HTTP Server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');
      await connectionManager.shutdown();
      await mcpServer.shutdown();
      systemDb.close();
      httpServer.close(() => {
        logger.info('HTTP Server closed');
        process.exit(0);
      });
    });

  } catch (error: any) {
    logger.error('Failed to start server: ' + error.message);
    if (error.stack) logger.error(error.stack);
    process.exit(1);
  }
}

if (config.mcpTransport === 'stdio') {
  mcpServer.runStdio().catch((error) => {
    logger.error('Failed to start MCP stdio server:', error);
    process.exit(1);
  });
} else {
  bootstrap().catch((error) => {
    logger.error('Failed to bootstrap server:', error);
    process.exit(1);
  });
}
