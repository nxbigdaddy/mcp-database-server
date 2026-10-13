import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { queryExecutor } from '@/services/QueryExecutor';
import { metadataService } from '@/services/MetadataService';
import { connectionManager } from '@/database/ConnectionManager';
import { logger } from '@/utils/logger';
import type { Request, Response } from 'express';

const TOOLS = [
  {
    name: 'sql_query',
    description: 'Execute a SQL query on a specified database connection. Returns query results with column metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
        sql: {
          type: 'string',
          description: 'SQL statement to execute',
        },
        params: {
          type: 'array',
          items: { type: 'string' },
          description: 'Query parameters (positional)',
        },
        limit: {
          type: 'number',
          default: 100,
          description: 'Maximum number of rows to return',
        },
        offset: {
          type: 'number',
          default: 0,
          description: 'Number of rows to skip',
        },
      },
      required: ['connection', 'sql'],
    },
  },
  {
    name: 'list_databases',
    description: 'List all databases in the connection',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
      },
      required: ['connection'],
    },
  },
  {
    name: 'list_tables',
    description: 'List all tables in a database. Optionally filter by schema.',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
        database: {
          type: 'string',
          description: 'Database name (optional for single-database systems)',
        },
        schema: {
          type: 'string',
          description: 'Schema name (optional, for PostgreSQL etc.)',
        },
      },
      required: ['connection'],
    },
  },
  {
    name: 'get_table_schema',
    description: 'Get detailed schema information for a specific table, including columns, primary keys, and indexes.',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
        database: {
          type: 'string',
          description: 'Database name',
        },
        table: {
          type: 'string',
          description: 'Table name',
        },
        schema: {
          type: 'string',
          description: 'Schema name (optional)',
        },
      },
      required: ['connection', 'table'],
    },
  },
  {
    name: 'get_indexes',
    description: 'Get index information for a specific table',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
        table: {
          type: 'string',
          description: 'Table name',
        },
        schema: {
          type: 'string',
          description: 'Schema name (optional)',
        },
      },
      required: ['connection', 'table'],
    },
  },
  {
    name: 'get_foreign_keys',
    description: 'Get foreign key information for a specific table',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
        table: {
          type: 'string',
          description: 'Table name',
        },
        schema: {
          type: 'string',
          description: 'Schema name (optional)',
        },
      },
      required: ['connection', 'table'],
    },
  },
  {
    name: 'execute_procedure',
    description: 'Execute a stored procedure with the given parameters',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
        procedure: {
          type: 'string',
          description: 'Stored procedure name',
        },
        params: {
          type: 'array',
          items: { type: 'string' },
          description: 'Procedure parameters',
        },
      },
      required: ['connection', 'procedure'],
    },
  },
  {
    name: 'begin_transaction',
    description: 'Begin a new database transaction',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
      },
      required: ['connection'],
    },
  },
  {
    name: 'commit_transaction',
    description: 'Commit a database transaction',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
        transactionId: {
          type: 'string',
          description: 'Transaction ID',
        },
      },
      required: ['connection', 'transactionId'],
    },
  },
  {
    name: 'rollback_transaction',
    description: 'Rollback a database transaction',
    inputSchema: {
      type: 'object',
      properties: {
        connection: {
          type: 'string',
          description: 'Database connection name or ID',
        },
        transactionId: {
          type: 'string',
          description: 'Transaction ID',
        },
      },
      required: ['connection', 'transactionId'],
    },
  },
];

export class MCPServer {
  private server: Server;
  private transport: StdioServerTransport | SSEServerTransport | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-database-server',
        version: process.env.npm_package_version || '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.executeTool(name, args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const connections = connectionManager.getStatus();
      const resources = [];

      for (const conn of connections) {
        resources.push(
          {
            uri: `db://${conn.name}/databases`,
            name: `${conn.name} - Databases`,
            description: 'List all databases',
            mimeType: 'application/json',
          },
          {
            uri: `db://${conn.name}/*/tables`,
            name: `${conn.name} - Tables`,
            description: 'List all tables',
            mimeType: 'application/json',
          },
          {
            uri: `db://${conn.name}/*/*/schema`,
            name: `${conn.name} - Table Schemas`,
            description: 'Get table schema information',
            mimeType: 'application/json',
          }
        );
      }

      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const result = await this.readResource(uri);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    });
  }

  async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'sql_query':
        return queryExecutor.execute(args.connection, args.sql, args.params, {
          limit: args.limit,
          offset: args.offset,
          clientType: 'mcp_client',
        });

      case 'list_databases':
        return metadataService.getDatabases(args.connection);

      case 'list_tables':
        return metadataService.getTables(args.connection, args.database, args.schema);

      case 'get_table_schema':
        return metadataService.getTableSchema(args.connection, args.table, args.database, args.schema);

      case 'get_indexes':
        return metadataService.getIndexes(args.connection, args.table, args.database, args.schema);

      case 'get_foreign_keys':
        return metadataService.getForeignKeys(args.connection, args.table, args.database, args.schema);

      case 'execute_procedure':
        return metadataService.executeProcedure(args.connection, args.procedure, args.params);

      case 'begin_transaction':
        return { transactionId: await queryExecutor.beginTransaction(args.connection) };

      case 'commit_transaction':
        await queryExecutor.commitTransaction(args.connection, args.transactionId);
        return { success: true };

      case 'rollback_transaction':
        await queryExecutor.rollbackTransaction(args.connection, args.transactionId);
        return { success: true };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async readResource(uri: string): Promise<any> {
    const parts = uri.replace('db://', '').split('/');
    const connectionName = parts[0];
    const resourceType = parts[1];

    switch (resourceType) {
      case 'databases':
        return metadataService.getDatabases(connectionName);

      case 'tables':
        return metadataService.getTables(connectionName, parts[2]);

      case 'schema':
        return metadataService.getTableSchema(connectionName, parts[3], parts[2]);

      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  async runStdio(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    logger.info('MCP Server started with stdio transport');
  }

  async runSSE(req: Request, res: Response): Promise<void> {
    this.transport = new SSEServerTransport('/messages', res);
    await this.server.connect(this.transport);
    logger.info('MCP Server started with SSE transport');
  }

  async handleMessage(req: Request, res: Response): Promise<void> {
    if (this.transport instanceof SSEServerTransport) {
      await this.transport.handlePostMessage(req, res);
    } else {
      res.status(500).json({ error: 'SSE transport not initialized' });
    }
  }

  async shutdown(): Promise<void> {
    await this.server.close();
    logger.info('MCP Server shutdown complete');
  }
}

export const mcpServer = new MCPServer();
