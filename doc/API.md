# MCP Database Server API 文档

## 1. API 概述

### 1.1 基础信息

- **Base URL**: `http://<host>:3000/api`
- **认证方式**: API Key (可选)
- **请求格式**: JSON
- **响应格式**: JSON

### 1.2 认证

如需启用 API Key 认证，在请求头中添加:

```
X-API-Key: YOUR_SECRET
```

### 1.3 通用响应格式

**成功响应:**
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }
  }
}
```

### 1.4 通用错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_PARAMS` | 参数无效 |
| `CONNECTION_NOT_FOUND` | 连接不存在 |
| `CONNECTION_FAILED` | 连接失败 |
| `QUERY_FAILED` | 查询执行失败 |
| `UNAUTHORIZED` | 未授权 |
| `FORBIDDEN` | 禁止访问 |
| `NOT_FOUND` | 资源不存在 |
| `INTERNAL_ERROR` | 内部错误 |

---

## 2. 连接管理 API

### 2.1 获取连接列表

```http
GET /api/connections
```

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conn_001",
      "name": "prod_mysql",
      "type": "mysql",
      "host": "203.0.113.10",
      "port": 3306,
      "database": "production",
      "pool_min": 2,
      "pool_max": 10,
      "read_only": false,
      "enabled": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2.2 获取单个连接

```http
GET /api/connections/:id
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "conn_001",
    "name": "prod_mysql",
    "type": "mysql",
    "host": "203.0.113.10",
    "port": 3306,
    "database": "production",
    "username": "dbuser",
    "password": "encrypted_password",
    "ssl_enabled": false,
    "pool_min": 2,
    "pool_max": 10,
    "pool_idle_timeout": 30000,
    "read_only": false,
    "sql_whitelist": ["SELECT", "SHOW"],
    "enabled": true
  }
}
```

### 2.3 创建连接

```http
POST /api/connections
Content-Type: application/json
```

**请求体:**
```json
{
  "name": "prod_mysql",
  "type": "mysql",
  "host": "203.0.113.10",
  "port": 3306,
  "database": "production",
  "username": "dbuser",
  "password": "password123",
  "ssl_enabled": false,
  "pool_min": 2,
  "pool_max": 10,
  "pool_idle_timeout": 30000,
  "read_only": false,
  "sql_whitelist": ["SELECT", "SHOW", "DESCRIBE"]
}
```

**参数说明:**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| name | string | 是 | - | 连接名称 (唯一) |
| type | string | 是 | - | 数据库类型：mysql\|postgresql\|sqlserver\|oracle\|sqlite |
| host | string | 否 | - | 主机地址 (SQLite 不需要) |
| port | number | 否 | - | 端口 (SQLite 不需要) |
| database | string | 是 | - | 数据库名或 SQLite 文件路径 |
| username | string | 否 | - | 用户名 (SQLite 不需要) |
| password | string | 否 | - | 密码 (SQLite 不需要) |
| ssl_enabled | boolean | 否 | false | 是否启用 SSL |
| pool_min | number | 否 | 2 | 最小连接数 |
| pool_max | number | 否 | 10 | 最大连接数 |
| pool_idle_timeout | number | 否 | 30000 | 空闲超时 (ms) |
| read_only | boolean | 否 | false | 只读模式 |
| sql_whitelist | string[] | 否 | - | SQL 类型白名单 |

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "conn_001",
    "name": "prod_mysql",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "连接创建成功"
}
```

### 2.4 更新连接

```http
PUT /api/connections/:id
Content-Type: application/json
```

**请求体:** 同创建连接 (只包含需要更新的字段)

**响应:**
```json
{
  "success": true,
  "message": "连接更新成功"
}
```

### 2.5 删除连接

```http
DELETE /api/connections/:id
```

**响应:**
```json
{
  "success": true,
  "message": "连接已删除"
}
```

### 2.6 测试连接

```http
POST /api/connections/:id/test
```

**响应:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "latency_ms": 45,
    "server_version": "8.0.32",
    "message": "连接成功"
  }
}
```

### 2.7 心跳检测

```http
POST /api/connections/:id/ping
```

**响应:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "latency_ms": 12
  }
}
```

### 2.8 重置连接池

```http
POST /api/connections/:id/pool/reset
```

**响应:**
```json
{
  "success": true,
  "message": "连接池已重置"
}
```

---

## 3. SQL 执行 API

### 3.1 执行 SQL 查询

```http
POST /api/query
Content-Type: application/json
```

**请求体:**
```json
{
  "connection": "conn_001",
  "sql": "SELECT * FROM users WHERE status = ?",
  "params": ["active"],
  "limit": 100,
  "offset": 0,
  "timeout_ms": 30000
}
```

**参数说明:**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| connection | string | 是 | - | 连接 ID 或名称 |
| sql | string | 是 | - | SQL 语句 |
| params | any[] | 否 | [] | 参数值数组 |
| limit | number | 否 | 100 | 返回行数限制 |
| offset | number | 否 | 0 | 偏移量 |
| timeout_ms | number | 否 | 30000 | 超时时间 (ms) |

**响应:**
```json
{
  "success": true,
  "data": {
    "columns": [
      { "name": "id", "type": "INTEGER" },
      { "name": "username", "type": "VARCHAR" },
      { "name": "email", "type": "VARCHAR" }
    ],
    "rows": [
      [1, "user1", "user1@example.com"],
      [2, "user2", "user2@example.com"]
    ],
    "rowCount": 2,
    "executionTime": 45,
    "truncated": false
  }
}
```

### 3.2 事务内执行 SQL

```http
POST /api/query/transaction
Content-Type: application/json
```

**请求体:**
```json
{
  "connection": "conn_001",
  "transactionId": "txn_123",
  "sql": "INSERT INTO users (username, email) VALUES (?, ?)",
  "params": ["newuser", "newuser@example.com"]
}
```

### 3.3 批量执行 SQL

```http
POST /api/query/batch
Content-Type: application/json
```

**请求体:**
```json
{
  "connection": "conn_001",
  "statements": [
    {
      "sql": "INSERT INTO users (username) VALUES (?)",
      "params": ["user1"]
    },
    {
      "sql": "INSERT INTO users (username) VALUES (?)",
      "params": ["user2"]
    }
  ],
  "transaction": true
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "results": [
      { "rowCount": 1, "executionTime": 10 },
      { "rowCount": 1, "executionTime": 8 }
    ],
    "totalExecutionTime": 18,
    "errors": []
  }
}
```

### 3.4 执行计划分析

```http
POST /api/query/explain
Content-Type: application/json
```

**请求体:**
```json
{
  "connection": "conn_001",
  "sql": "SELECT * FROM users WHERE id = ?",
  "params": [1]
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "plan": [
      {
        "id": 1,
        "operation": "INDEX SEEK",
        "table": "users",
        "index": "PK_users",
        "cost": 0.003
      }
    ],
    "estimatedCost": 0.003
  }
}
```

---

## 4. 元数据查询 API

### 4.1 获取数据库列表

```http
GET /api/:connectionId/databases
```

**响应:**
```json
{
  "success": true,
  "data": [
    { "name": "master", "size": 1024000, "charset": "utf8mb4" },
    { "name": "production", "size": 5120000, "charset": "utf8mb4" }
  ]
}
```

### 4.2 获取表列表

```http
GET /api/:connectionId/tables?database=production&schema=public
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| database | string | 数据库名 (可选) |
| schema | string | Schema 名 (可选) |

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "name": "users",
      "type": "TABLE",
      "rowCount": 10000,
      "size": 1024000,
      "engine": "InnoDB",
      "charset": "utf8mb4"
    },
    {
      "name": "orders",
      "type": "TABLE",
      "rowCount": 50000,
      "size": 5120000,
      "engine": "InnoDB",
      "charset": "utf8mb4"
    }
  ]
}
```

### 4.3 获取视图列表

```http
GET /api/:connectionId/views?database=production
```

**响应:**
```json
{
  "success": true,
  "data": [
    { "name": "v_active_users", "definition": "SELECT ..." }
  ]
}
```

### 4.4 获取存储过程列表

```http
GET /api/:connectionId/procedures?database=production
```

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "name": "sp_update_user",
      "parameters": [
        { "name": "p_user_id", "type": "INT", "mode": "IN" },
        { "name": "p_username", "type": "VARCHAR", "mode": "IN" }
      ]
    }
  ]
}
```

### 4.5 获取函数列表

```http
GET /api/:connectionId/functions?database=production
```

### 4.6 获取表结构

```http
GET /api/:connectionId/schema/:table?database=production
```

**响应:**
```json
{
  "success": true,
  "data": {
    "table": "users",
    "columns": [
      {
        "name": "id",
        "type": "INTEGER",
        "length": null,
        "nullable": false,
        "default": null,
        "primaryKey": true,
        "autoIncrement": true,
        "comment": "用户 ID"
      },
      {
        "name": "username",
        "type": "VARCHAR",
        "length": 50,
        "nullable": false,
        "default": null,
        "primaryKey": false,
        "autoIncrement": false,
        "comment": "用户名"
      },
      {
        "name": "email",
        "type": "VARCHAR",
        "length": 100,
        "nullable": true,
        "default": null,
        "primaryKey": false,
        "autoIncrement": false,
        "comment": "邮箱"
      },
      {
        "name": "created_at",
        "type": "DATETIME",
        "length": null,
        "nullable": false,
        "default": "CURRENT_TIMESTAMP",
        "primaryKey": false,
        "autoIncrement": false,
        "comment": "创建时间"
      }
    ],
    "primaryKey": ["id"],
    "indexes": [
      {
        "name": "PK_users",
        "columns": ["id"],
        "unique": true,
        "type": "PRIMARY"
      },
      {
        "name": "idx_username",
        "columns": ["username"],
        "unique": true,
        "type": "NORMAL"
      }
    ],
    "foreignKeys": []
  }
}
```

### 4.7 获取索引信息

```http
GET /api/:connectionId/indexes/:table?database=production
```

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "name": "PK_users",
      "columns": ["id"],
      "unique": true,
      "type": "PRIMARY",
      "size": 1024
    },
    {
      "name": "idx_username",
      "columns": ["username"],
      "unique": true,
      "type": "BTREE",
      "size": 512
    }
  ]
}
```

### 4.8 获取外键信息

```http
GET /api/:connectionId/fkeys/:table?database=production
```

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "column": "order_user_id",
      "refTable": "users",
      "refColumn": "id",
      "onDelete": "CASCADE",
      "onUpdate": "CASCADE"
    }
  ]
}
```

---

## 5. 数据操作 API

### 5.1 查询表数据

```http
GET /api/:connectionId/data/:table?database=production&page=1&pageSize=100&sort=id&order=ASC
```

**查询参数:**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| database | string | - | 数据库名 |
| page | number | 1 | 页码 |
| pageSize | number | 100 | 每页条数 |
| sort | string | - | 排序字段 |
| order | string | ASC | 排序方向 (ASC/DESC) |
| filter | string | - | 筛选条件 (JSON) |

**筛选条件示例:**
```json
{
  "status": "active",
  "age": { ">": 18 },
  "username": { "like": "%admin%" }
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "columns": ["id", "username", "email", "status"],
    "rows": [
      [1, "admin", "admin@example.com", "active"],
      [2, "user1", "user1@example.com", "active"]
    ],
    "pagination": {
      "page": 1,
      "pageSize": 100,
      "total": 10000,
      "totalPages": 100
    }
  }
}
```

### 5.2 插入数据

```http
POST /api/:connectionId/data/:table
Content-Type: application/json
```

**请求体:**
```json
{
  "database": "production",
  "data": {
    "username": "newuser",
    "email": "newuser@example.com",
    "status": "active"
  }
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": 1001,
    "rowCount": 1
  },
  "message": "数据插入成功"
}
```

### 5.3 更新数据

```http
PUT /api/:connectionId/data/:table/:id
Content-Type: application/json
```

**请求体:**
```json
{
  "database": "production",
  "data": {
    "email": "newemail@example.com",
    "status": "inactive"
  }
}
```

### 5.4 删除数据

```http
DELETE /api/:connectionId/data/:table/:id?database=production
```

**响应:**
```json
{
  "success": true,
  "data": {
    "rowCount": 1
  },
  "message": "数据删除成功"
}
```

---

## 6. 审计日志 API

### 6.1 查询审计日志

```http
GET /api/audit/logs?page=1&pageSize=100&connectionId=conn_001&status=success&startDate=2024-01-01&endDate=2024-01-31
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| connectionId | string | 连接 ID |
| status | string | 状态 (success/error) |
| sqlType | string | SQL 类型 |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |
| search | string | 搜索关键词 |

**响应:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "connection_id": "conn_001",
        "connection_name": "prod_mysql",
        "user_identifier": "mcp_client_001",
        "sql_text": "SELECT * FROM users WHERE id = ?",
        "sql_type": "SELECT",
        "database_name": "production",
        "table_name": "users",
        "parameters": ["1"],
        "execution_time_ms": 45,
        "row_count": 1,
        "status": "success",
        "error_message": null,
        "client_ip": "203.0.113.10",
        "client_type": "mcp_client",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 100,
      "total": 1000,
      "totalPages": 10
    }
  }
}
```

### 6.2 获取单条日志详情

```http
GET /api/audit/logs/:id
```

### 6.3 获取统计信息

```http
GET /api/audit/stats?startDate=2024-01-01&endDate=2024-01-31
```

**响应:**
```json
{
  "success": true,
  "data": {
    "totalQueries": 10000,
    "successQueries": 9800,
    "errorQueries": 200,
    "avgExecutionTime": 45.6,
    "slowQueries": 150,
    "queriesByType": {
      "SELECT": 8000,
      "INSERT": 1000,
      "UPDATE": 800,
      "DELETE": 200
    },
    "queriesByConnection": {
      "prod_mysql": 6000,
      "dev_pg": 4000
    },
    "topSlowQueries": [
      {
        "sql": "SELECT * FROM large_table WHERE ...",
        "avg_time": 5000,
        "count": 10
      }
    ],
    "trend": [
      { "date": "2024-01-01", "count": 300 },
      { "date": "2024-01-02", "count": 350 }
    ]
  }
}
```

### 6.4 导出审计日志

```http
GET /api/audit/export?format=csv&startDate=2024-01-01&endDate=2024-01-31
```

**响应:** 文件下载 (CSV 或 JSON 格式)

### 6.5 清空审计日志

```http
DELETE /api/audit/logs?beforeDate=2024-01-01
```

**参数:**
- `beforeDate`: 清除此日期之前的日志

---

## 7. 系统管理 API

### 7.1 获取系统设置

```http
GET /api/settings
```

**响应:**
```json
{
  "success": true,
  "data": {
    "audit_retention_days": 30,
    "max_query_rows": 10000,
    "default_query_limit": 100,
    "query_timeout_ms": 30000,
    "enable_slow_query_log": true,
    "slow_query_threshold_ms": 1000,
    "web_ui_enabled": true,
    "mcp_transport": "sse",
    "allow_ddl": false,
    "require_confirmation_delete": true
  }
}
```

### 7.2 更新系统设置

```http
PUT /api/settings
Content-Type: application/json
```

**请求体:**
```json
{
  "audit_retention_days": 60,
  "max_query_rows": 5000,
  "query_timeout_ms": 60000
}
```

### 7.3 健康检查

```http
GET /api/health
```

**响应:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0",
    "uptime": 86400,
    "database": {
      "system": {
        "status": "connected",
        "size": 1024000
      },
      "connections": {
        "prod_mysql": {
          "status": "connected",
          "pool": { "active": 2, "idle": 8, "total": 10 }
        },
        "dev_pg": {
          "status": "error",
          "error": "Connection refused"
        }
      }
    },
    "memory": {
      "used": "128MB",
      "total": "512MB",
      "usage": 25
    }
  }
}
```

### 7.4 版本信息

```http
GET /api/version
```

**响应:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "buildDate": "2024-01-01",
    "nodeVersion": "18.19.0",
    "mcpVersion": "0.1.0"
  }
}
```

### 7.5 创建配置备份

```http
POST /api/backup
```

**响应:**
```json
{
  "success": true,
  "data": {
    "filename": "backup_20240115_103000.json",
    "size": 10240,
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "备份创建成功"
}
```

### 7.6 恢复配置备份

```http
POST /api/restore
Content-Type: multipart/form-data
```

**请求体:**
- `file`: 备份文件

**响应:**
```json
{
  "success": true,
  "message": "配置恢复成功"
}
```

---

## 8. MCP 协议接口

### 8.1 SSE Endpoint

```http
GET http://<host>:3001/sse
```

用于 AI 客户端通过 Server-Sent Events 连接 MCP Server。

### 8.2 消息格式

MCP 协议消息遵循 [MCP Specification](https://modelcontextprotocol.io/)。

### 8.3 可用 Tools

| Tool | 描述 |
|------|------|
| `sql_query` | 执行 SQL 查询 |
| `list_databases` | 获取数据库列表 |
| `list_tables` | 获取表列表 |
| `get_table_schema` | 获取表结构 |
| `get_indexes` | 获取索引信息 |
| `execute_procedure` | 执行存储过程 |
| `begin_transaction` | 开始事务 |
| `commit_transaction` | 提交事务 |
| `rollback_transaction` | 回滚事务 |

---

*最后更新：2024-01-01*
