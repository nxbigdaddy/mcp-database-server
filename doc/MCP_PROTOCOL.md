# MCP 协议集成文档

## 1. MCP 协议概述

### 1.1 什么是 MCP

Model Context Protocol (MCP) 是一个开放协议，用于标准化 AI 模型与外部工具和服务的交互。MCP Database Server 通过 MCP 协议为大模型开发平台提供统一的数据库访问接口。

### 1.2 传输方式

MCP Database Server 支持两种 MCP 传输方式:

| 传输方式 | 端口 | 适用场景 | 配置 |
|----------|------|----------|------|
| **SSE** (Server-Sent Events) | 3001 | HTTP 环境，远程 AI 平台 | `MCP_TRANSPORT=sse` |
| **Stdio** (标准输入输出) | - | 本地进程调用 | `MCP_TRANSPORT=stdio` |

### 1.3 架构模式

```
┌─────────────────┐         MCP Protocol          ┌──────────────────────┐
│  AI 开发平台     │◄─────────────────────────────►│  MCP Database Server │
│  (MCP Client)   │                               │                      │
│                 │   - Tools (工具调用)           │  - 数据库连接管理     │
│  - Claude Desktop│   - Resources (资源访问)      │  - SQL 执行引擎       │
│  - 其他兼容平台  │   - Prompts (提示模板)        │  - 审计日志          │
└─────────────────┘                               └──────────────────────┘
```

---

## 2. MCP Tools 实现

### 2.1 Tools 列表

| Tool 名称 | 描述 | 输入 Schema |
|-----------|------|-------------|
| `sql_query` | 执行 SQL 查询 | connection, sql, params, limit, offset |
| `list_databases` | 获取数据库列表 | connection |
| `list_tables` | 获取表列表 | connection, database, schema |
| `get_table_schema` | 获取表结构 | connection, database, table |
| `get_indexes` | 获取索引信息 | connection, database, table |
| `get_foreign_keys` | 获取外键信息 | connection, database, table |
| `execute_procedure` | 执行存储过程 | connection, procedure, params |
| `execute_function` | 执行函数 | connection, function, params |
| `begin_transaction` | 开始事务 | connection |
| `commit_transaction` | 提交事务 | transactionId |
| `rollback_transaction` | 回滚事务 | transactionId |
| `execute_batch` | 批量执行 SQL | connection, statements |

### 2.2 Tool 详细定义

#### sql_query

```json
{
  "name": "sql_query",
  "description": "Execute a SQL query on a specified database connection. Returns query results with column metadata.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "connection": {
        "type": "string",
        "description": "Database connection name or ID"
      },
      "sql": {
        "type": "string",
        "description": "SQL statement to execute"
      },
      "params": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Query parameters (positional)"
      },
      "limit": {
        "type": "number",
        "default": 100,
        "description": "Maximum number of rows to return"
      },
      "offset": {
        "type": "number",
        "default": 0,
        "description": "Number of rows to skip"
      }
    },
    "required": ["connection", "sql"]
  }
}
```

**示例调用:**
```json
{
  "tool": "sql_query",
  "arguments": {
    "connection": "prod_mysql",
    "sql": "SELECT * FROM users WHERE status = ? AND created_at > ?",
    "params": ["active", "2024-01-01"],
    "limit": 50
  }
}
```

**返回结果:**
```json
{
  "content": [
    {
      "type": "json",
      "text": "{\"columns\":[{\"name\":\"id\",\"type\":\"INTEGER\"},{\"name\":\"username\",\"type\":\"VARCHAR\"},{\"name\":\"email\",\"type\":\"VARCHAR\"},{\"name\":\"created_at\",\"type\":\"DATETIME\"}],\"rows\":[[1,\"admin\",\"admin@example.com\",\"2024-01-15T10:30:00Z\"],[2,\"user1\",\"user1@example.com\",\"2024-01-16T14:20:00Z\"]],\"rowCount\":2,\"executionTime\":45}"
    }
  ]
}
```

#### list_tables

```json
{
  "name": "list_tables",
  "description": "List all tables in a database. Optionally filter by schema.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "connection": {
        "type": "string",
        "description": "Database connection name or ID"
      },
      "database": {
        "type": "string",
        "description": "Database name (optional for single-database systems)"
      },
      "schema": {
        "type": "string",
        "description": "Schema name (optional, for PostgreSQL etc.)"
      }
    },
    "required": ["connection"]
  }
}
```

**示例调用:**
```json
{
  "tool": "list_tables",
  "arguments": {
    "connection": "prod_mysql",
    "database": "production"
  }
}
```

**返回结果:**
```json
{
  "content": [
    {
      "type": "json",
      "text": "{\"tables\":[{\"name\":\"users\",\"type\":\"TABLE\",\"rowCount\":10000},{\"name\":\"orders\",\"type\":\"TABLE\",\"rowCount\":50000},{\"name\":\"products\",\"type\":\"TABLE\",\"rowCount\":5000}]}"
    }
  ]
}
```

#### get_table_schema

```json
{
  "name": "get_table_schema",
  "description": "Get detailed schema information for a specific table, including columns, primary keys, and indexes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "connection": {
        "type": "string",
        "description": "Database connection name or ID"
      },
      "database": {
        "type": "string",
        "description": "Database name"
      },
      "table": {
        "type": "string",
        "description": "Table name"
      }
    },
    "required": ["connection", "table"]
  }
}
```

#### execute_procedure

```json
{
  "name": "execute_procedure",
  "description": "Execute a stored procedure with the given parameters.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "connection": {
        "type": "string",
        "description": "Database connection name or ID"
      },
      "procedure": {
        "type": "string",
        "description": "Stored procedure name"
      },
      "params": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "value": { "type": "string" },
            "direction": { "type": "string", "enum": ["IN", "OUT", "INOUT"] }
          }
        },
        "description": "Procedure parameters"
      }
    },
    "required": ["connection", "procedure"]
  }
}
```

---

## 3. MCP Resources 实现

### 3.1 Resource URIs

MCP Resources 提供对数据库对象的直接访问:

```
db://{connection}/databases                      # 数据库列表
db://{connection}/{database}/tables              # 表列表
db://{connection}/{database}/views               # 视图列表
db://{connection}/{database}/{table}             # 表数据 (前 100 行)
db://{connection}/{database}/{table}/schema      # 表结构
db://{connection}/{database}/{table}/indexes     # 索引信息
db://{connection}/{database}/{table}/data?limit=1000  # 自定义查询
```

### 3.2 Resource 定义

```typescript
const RESOURCES = [
  {
    uri: "db://{connection}/databases",
    name: "Database List",
    description: "List all databases in the connection",
    mimeType: "application/json"
  },
  {
    uri: "db://{connection}/{database}/tables",
    name: "Table List",
    description: "List all tables in a database",
    mimeType: "application/json"
  },
  {
    uri: "db://{connection}/{database}/{table}/schema",
    name: "Table Schema",
    description: "Get detailed schema for a table",
    mimeType: "application/json"
  }
];
```

### 3.3 Resource 读取处理

```typescript
async function readResource(uri: string): Promise<ResourceContents> {
  const parsed = parseResourceUri(uri);
  
  switch (parsed.type) {
    case 'databases':
      return await listDatabases(parsed.connection);
    case 'tables':
      return await listTables(parsed.connection, parsed.database);
    case 'schema':
      return await getTableSchema(parsed.connection, parsed.database, parsed.table);
    case 'data':
      return await getTableData(parsed.connection, parsed.database, parsed.table, parsed.params);
    default:
      throw new Error(`Unknown resource type: ${parsed.type}`);
  }
}
```

---

## 4. AI 平台集成示例

### 4.1 Claude Desktop 配置

在 Claude Desktop 配置文件中添加:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "database": {
      "command": "node",
      "args": ["/path/to/mcp-database-server/dist/index.js"],
      "env": {
        "SYSTEM_DB_PATH": "/path/to/data/system.db",
        "MCP_TRANSPORT": "stdio",
        "ENCRYPTION_KEY": "your-32-char-encryption-key"
      }
    }
  }
}
```

### 4.2 远程 SSE 连接配置

```json
{
  "mcpServers": {
    "database": {
      "url": "http://203.0.113.10:3001/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-api-key"
      }
    }
  }
}
```

### 4.3 使用示例对话

**用户:** "查看 prod_mysql 数据库中有哪些表"

**AI:** (调用 `list_tables` tool)
```json
{
  "tool": "list_tables",
  "arguments": {
    "connection": "prod_mysql",
    "database": "production"
  }
}
```

**AI 回复:** "prod_mysql 数据库的 production 库中有以下表:
- users (10,000 行)
- orders (50,000 行)
- products (5,000 行)"

---

**用户:** "查询最近注册的 10 个用户"

**AI:** (调用 `sql_query` tool)
```json
{
  "tool": "sql_query",
  "arguments": {
    "connection": "prod_mysql",
    "sql": "SELECT id, username, email, created_at FROM users ORDER BY created_at DESC LIMIT ?",
    "params": ["10"]
  }
}
```

---

**用户:** "查看 users 表的结构"

**AI:** (调用 `get_table_schema` tool)
```json
{
  "tool": "get_table_schema",
  "arguments": {
    "connection": "prod_mysql",
    "database": "production",
    "table": "users"
  }
}
```

---

## 5. 安全最佳实践

### 5.1 连接级别安全

```json
{
  "name": "prod_mysql_readonly",
  "type": "mysql",
  "host": "203.0.113.10",
  "read_only": true,
  "sql_whitelist": ["SELECT", "SHOW", "DESCRIBE", "EXPLAIN"]
}
```

### 5.2 参数化查询

**错误示例 (禁止):**
```javascript
const sql = `SELECT * FROM users WHERE username = '${username}'`;
```

**正确示例:**
```javascript
const sql = 'SELECT * FROM users WHERE username = ?';
const params = [username];
```

### 5.3 最小权限原则

为 MCP Server 创建专用的数据库用户，仅授予必要权限:

```sql
-- MySQL 示例
CREATE USER 'mcp_server'@'%' IDENTIFIED BY 'strong_password';
GRANT SELECT, SHOW DATABASES ON production.* TO 'mcp_server'@'%';
FLUSH PRIVILEGES;
```

---

## 6. 性能优化

### 6.1 连接池配置

```typescript
const poolConfig = {
  min: 2,           // 最小空闲连接
  max: 10,          // 最大连接数
  idleTimeout: 30000,  // 空闲超时 (ms)
  acquireTimeout: 5000   // 获取连接超时 (ms)
};
```

### 6.2 查询结果限制

- 默认限制返回 100 行
- 最大限制 10000 行
- 超过限制自动截断并提示

### 6.3 缓存策略

对于元数据查询 (表结构、索引等)，实现短期缓存:

```typescript
const METADATA_CACHE_TTL = 60000; // 1 分钟

async function getTableSchema(connection, table) {
  const cacheKey = `${connection}:${table}`;
  const cached = metadataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < METADATA_CACHE_TTL) {
    return cached.data;
  }
  
  const schema = await fetchSchemaFromDB(connection, table);
  metadataCache.set(cacheKey, { data: schema, timestamp: Date.now() });
  return schema;
}
```

---

## 7. 错误处理

### 7.1 错误响应格式

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: CONNECTION_FAILED - Unable to connect to database 'prod_mysql': Connection refused"
    }
  ],
  "isError": true
}
```

### 7.2 常见错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `CONNECTION_NOT_FOUND` | 连接不存在 | 检查连接名称是否正确 |
| `CONNECTION_FAILED` | 连接失败 | 检查数据库服务状态和网络 |
| `QUERY_FAILED` | 查询执行失败 | 检查 SQL 语法和权限 |
| `TIMEOUT` | 查询超时 | 优化 SQL 或增加超时时间 |
| `READ_ONLY` | 只读模式禁止写操作 | 使用只读连接或切换到读写连接 |
| `ROW_LIMIT_EXCEEDED` | 超过行数限制 | 添加 LIMIT 子句或使用分页 |

---

## 8. 监控与日志

### 8.1 MCP 请求日志

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "type": "mcp_request",
  "tool": "sql_query",
  "connection": "prod_mysql",
  "sql_type": "SELECT",
  "execution_time_ms": 45,
  "status": "success",
  "row_count": 10
}
```

### 8.2 性能指标

- 平均响应时间
- 工具调用次数统计
- 错误率
- 连接池使用率

---

## 9. 扩展开发

### 9.1 添加新 Tool

```typescript
// src/mcp/tools/customTool.ts
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const customTool: Tool = {
  name: 'custom_tool',
  description: 'Custom tool description',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter 1' }
    },
    required: ['param1']
  }
};

export async function executeCustomTool(args: any): Promise<any> {
  // Tool implementation
  return { result: 'success' };
}
```

### 9.2 注册 Tool

```typescript
// src/mcp/tools/index.ts
import { customTool, executeCustomTool } from './customTool';

export const TOOLS = [
  // ... existing tools
  customTool
];

export const TOOL_HANDLERS = {
  // ... existing handlers
  custom_tool: executeCustomTool
};
```

---

## 10. 测试

### 10.1 MCP 协议测试

```typescript
import { describe, it, expect } from 'vitest';
import { MCPServer } from '../src/mcp/server';

describe('MCP Tools', () => {
  it('should execute sql_query tool', async () => {
    const server = new MCPServer();
    const result = await server.executeTool('sql_query', {
      connection: 'test_db',
      sql: 'SELECT 1'
    });
    
    expect(result.success).toBe(true);
  });
});
```

---

*最后更新：2024-01-01*
