import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import path from 'path';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { authMiddleware, ipWhitelistMiddleware, errorMiddleware, notFoundMiddleware } from '@/middleware';
import routes from '@/routes';

export function createApp(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
  }));

  app.use(authMiddleware);
  app.use(ipWhitelistMiddleware);

  app.use('/api', routes);

  if (config.webUiEnabled) {
    const publicPath = path.join(__dirname, 'public');
    app.use(express.static(publicPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.json({
        name: 'MCP Database Server',
        version: process.env.npm_package_version || '1.0.0',
        description: 'Database connection service for AI development platforms',
        endpoints: {
          api: '/api',
          health: '/api/health',
          version: '/api/version',
          mcp: config.mcpTransport === 'sse' ? `http://localhost:${config.mcpPort}/sse` : 'stdio',
        },
      });
    });

    app.use(notFoundMiddleware);
  }

  app.use(errorMiddleware);

  return app;
}
