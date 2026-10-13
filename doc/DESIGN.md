# MCP Database Server 设计文档

## 1. 项目概述

### 1.1 项目简介

MCP Database Server 是一个基于 Model Context Protocol (MCP) 标准的数据库连接服务，用于为公司内部 AI 开发平台提供统一的数据库访问接口。支持多种主流数据库，提供 Web UI 管理界面和标准 MCP 协议接口。

### 1.2 核心目标

- 为 AI 大模型开发平台提供统一的数据库访问 MCP Server
- 支持多种数据库：MySQL、PostgreSQL、SQL Server、Oracle、SQLite
- 提供功能完善的 Web UI 管理界面
- 支持 1Panel 一键部署
- 完整的审计日志功能
- 灵活的安全配置选项

### 1.3 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| **运行时** | Node.js | 18+ LTS |
| **语言** | TypeScript | 5.x |
| **Web 框架** | Express | 4.x |
| **MCP SDK** | @modelcontextprotocol/sdk | latest |
| **UI 框架** | React | 18.x |
| **UI 组件库** | Ant Design | 5.x |
| **样式** | TailwindCSS | 3.x |
| **状态管理** | Zustand | 4.x |
| **系统数据库** | SQLite | 3.x (better-sqlite3) |
| **MySQL 驱动** | mysql2 | 3.x |
| **PostgreSQL 驱动** | pg | 8.x |
| **SQL Server 驱动** | tedious | latest |
| **Oracle 驱动** | oracledb | 6.x |
| **SQLite 驱动** | better-sqlite3 | 9.x |
| **部署** | Docker + Docker Compose | latest |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          1Panel 宿主机                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              MCP Database Server (Docker Container)            │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                    Web UI Layer                          │  │  │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │  │  │
│  │  │  │ 连接管理     │ │ SQL 工作台   │ │ 审计日志         │    │  │  │
│  │  │  │ 数据浏览     │ │ 表结构       │ │ 系统设置         │    │  │  │
│  │  │  └─────────────┘ └─────────────┘ └─────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                              │ HTTP/REST                      │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                   API Server Layer                       │  │  │
│  │  │              Express HTTP Server                         │  │  │
│  │  │  - REST API (端口 3000 - Web UI)                         │  │  │
│  │  │  - MCP SSE Endpoint (端口 3001 - AI Clients)             │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                              │                                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                  Business Logic Layer                    │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │  │  │
│  │  │  │ConnectionMgr │  │ QueryExecutor│  │  AuditService │  │  │  │
│  │  │  │- 连接池管理   │  │- SQL 执行     │  │  - 日志记录    │  │  │  │
│  │  │  │- 健康检查     │  │- 结果分页     │  │  - 日志查询    │  │  │  │
│  │  │  │- 权限验证     │  │- 事务管理     │  │  - 统计分析    │  │  │  │
│  │  │  └──────────────┘  └──────────────┘  └───────────────┘  │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐                     │  │  │
│  │  │  │MetadataService│ │ProcedureService│                    │  │  │
│  │  │  │- 表/视图结构   │  │- 存储过程     │                    │  │  │
│  │  │  │- 索引信息     │  │- 函数执行     │                    │  │  │
│  │  │  └──────────────┘  └──────────────┘                     │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                              │                                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                System Database (SQLite)                  │  │  │
│  │  │  - connections: 数据库连接配置                            │  │  │
│  │  │  - audit_logs: SQL 执行日志                               │  │  │
│  │  │  - settings: 系统设置                                     │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                              │                                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                  Database Drivers                        │  │  │
│  │  │   MySQL  │  PostgreSQL  │  SQL Server  │  Oracle  │ SQLite│  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                    │                                  │
│         ┌──────────────────────────┼──────────────────────────┐      │
│         ▼                          ▼                          ▼      │
│    ┌─────────┐              ┌─────────┐              ┌─────────┐    │
│    │  MySQL  │              │   MSSQL │              │ Oracle  │    │
│    │ 业务库   │              │  业务库  │              │ 业务库   │    │
│    └─────────┘              └─────────┘              └─────────┘    │
│                                                                      │
│         ┌──────────────────────────────────────────────────┐        │
│         │              AI 开发平台 (MCP Clients)             │        │
│         │         (Claude Desktop / 其他 MCP 兼容平台)        │        │
│         └──────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 端口规划

| 端口 | 用途 | 说明 |
|------|------|------|
| 3000 | Web UI + REST API | 浏览器访问和管理界面 |
| 3001 | MCP SSE Endpoint | AI 客户端 MCP 协议连接 |
| 3002 | MCP Stdio (可选) | 本地进程调用模式 |

---

## 3. 功能模块设计

### 3.1 MCP Tools 定义

| Tool 名称 | 描述 | 输入参数 | 返回值 |
|-----------|------|----------|--------|
| `sql_query` | 执行 SQL 查询 | connection, sql, params, limit, offset | { columns, rows, rowCount, executionTime } |
| `list_databases` | 获取数据库列表 | connection | [{ name, size, charset }] |
| `list_tables` | 获取表列表 | connection, database, schema | [{ name, type, rowCount, size }] |
| `get_table_schema` | 获取表结构 | connection, database, table | { columns, primaryKey, indexes } |
| `get_indexes` | 获取索引信息 | connection, database, table | [{ name, columns, type, unique }] |
| `get_foreign_keys` | 获取外键信息 | connection, database, table | [{ column, refTable, refColumn }] |
| `execute_procedure` | 执行存储过程 | connection, procedure, params | { resultSets, outputParams } |
| `execute_function` | 执行标量函数 | connection, function, params | { result } |
| `begin_transaction` | 开始事务 | connection | { transactionId } |
| `commit_transaction` | 提交事务 | transactionId | { success } |
| `rollback_transaction` | 回滚事务 | transactionId | { success } |
| `execute_batch` | 批量执行 SQL | connection, statements | { results, errors } |

### 3.2 MCP Resources 定义

```
资源 URI 模式:
- db://{connection}/databases           - 数据库列表
- db://{connection}/{database}/tables   - 表列表
- db://{connection}/{database}/{table}  - 表数据
- db://{connection}/{database}/{table}/schema - 表结构
```

### 3.3 REST API 设计

#### 连接管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/connections` | 获取所有连接配置 |
| GET | `/api/connections/:id` | 获取单个连接详情 |
| POST | `/api/connections` | 创建新连接 |
| PUT | `/api/connections/:id` | 更新连接配置 |
| DELETE | `/api/connections/:id` | 删除连接 |
| POST | `/api/connections/:id/test` | 测试连接 |
| POST | `/api/connections/:id/ping` | 心跳检测 |
| POST | `/api/connections/:id/pool/reset` | 重置连接池 |

#### SQL 执行

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/query` | 执行 SQL 语句 |
| POST | `/api/query/transaction` | 事务内执行 SQL |
| POST | `/api/query/batch` | 批量执行 SQL |
| POST | `/api/query/explain` | 执行计划分析 |

#### 元数据查询

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/:connectionId/databases` | 获取数据库列表 |
| GET | `/api/:connectionId/tables` | 获取表列表 |
| GET | `/api/:connectionId/views` | 获取视图列表 |
| GET | `/api/:connectionId/procedures` | 获取存储过程列表 |
| GET | `/api/:connectionId/functions` | 获取函数列表 |
| GET | `/api/:connectionId/schema/:table` | 获取表结构 |
| GET | `/api/:connectionId/indexes/:table` | 获取索引信息 |
| GET | `/api/:connectionId/fkeys/:table` | 获取外键信息 |

#### 数据操作

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/:connectionId/data/:table` | 查询表数据 (支持分页、筛选) |
| POST | `/api/:connectionId/data/:table` | 插入数据 |
| PUT | `/api/:connectionId/data/:table/:id` | 更新数据 |
| DELETE | `/api/:connectionId/data/:table/:id` | 删除数据 |

#### 审计日志

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/audit/logs` | 查询审计日志 |
| GET | `/api/audit/logs/:id` | 获取单条日志详情 |
| GET | `/api/audit/stats` | 获取统计信息 |
| GET | `/api/audit/export` | 导出审计日志 (CSV/JSON) |
| DELETE | `/api/audit/logs` | 清空审计日志 |

#### 系统管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/settings` | 获取系统设置 |
| PUT | `/api/settings` | 更新系统设置 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/version` | 版本信息 |
| POST | `/api/backup` | 创建配置备份 |
| POST | `/api/restore` | 恢复配置备份 |

### 3.4 Web UI 页面设计

#### 页面结构

```
/                       # 仪表盘 (Dashboard)
/connections            # 连接管理列表
/connections/new        # 新建连接
/connections/:id/edit   # 编辑连接
/query                  # SQL 工作台
/query/history          # 查询历史
/data/:connectionId     # 数据浏览
/data/:connectionId/:table  # 表数据查看
/schema/:connectionId   # 表结构管理
/procedures/:connectionId  # 存储过程管理
/audit                  # 审计日志
/audit/stats            # 统计分析
/settings               # 系统设置
```

#### 核心功能模块

**1. 仪表盘 (Dashboard)**
- 连接状态概览
- 今日查询统计
- 慢查询 TOP10
- 系统资源使用

**2. 连接管理**
- 连接列表 (表格展示)
- 新建/编辑连接表单
- 连接测试
- 批量导入/导出
- 连接池状态监控

**3. SQL 工作台**
- Monaco SQL 编辑器 (语法高亮、智能提示)
- 执行结果展示 (表格/JSON/CSV)
- 查询历史记录
- 常用 SQL 片段保存
- 结果导出 (CSV/Excel/JSON)

**4. 数据浏览**
- 表数据分页展示
- 列筛选和排序
- 快速搜索
- 行内编辑 (可配置)
- 批量操作

**5. 表结构查看**
- 字段列表 (名称、类型、长度、是否为空、默认值)
- 索引管理
- 外键关系
- ER 图展示 (可选)

**6. 存储过程管理**
- 过程/函数列表
- 源码查看
- 参数配置和执行
- 执行结果展示

**7. 审计日志**
- 日志列表 (时间、连接、SQL、耗时、状态)
- 高级筛选
- 统计图表 (查询量趋势、耗时分布)
- 日志导出

**8. 系统设置**
- 连接池配置
- 安全策略 (只读模式、SQL 白名单)
- 审计日志保留策略
- 备份设置

---

## 4. 数据库设计

### 4.1 系统数据库 (SQLite)

#### 连接配置表 (connections)

```sql
CREATE TABLE connections (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT NOT NULL UNIQUE,        -- 连接名称
  type TEXT NOT NULL,               -- mysql|postgresql|sqlserver|oracle|sqlite
  host TEXT,                        -- 主机地址
  port INTEGER,                     -- 端口
  database TEXT NOT NULL,           -- 数据库名
  username TEXT,                    -- 用户名
  password TEXT,                    -- 加密存储的密码
  ssl_enabled BOOLEAN DEFAULT 0,    -- 是否启用 SSL
  ssl_options TEXT,                 -- SSL 配置 (JSON)
  pool_min INTEGER DEFAULT 2,       -- 最小连接数
  pool_max INTEGER DEFAULT 10,      -- 最大连接数
  pool_idle_timeout INTEGER DEFAULT 30000,  -- 空闲超时 (ms)
  read_only BOOLEAN DEFAULT 0,      -- 只读模式
  sql_whitelist TEXT,               -- SQL 白名单 (JSON 数组)
  enabled BOOLEAN DEFAULT 1,        -- 是否启用
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_connections_name ON connections(name);
CREATE INDEX idx_connections_type ON connections(type);
```

#### 审计日志表 (audit_logs)

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id TEXT NOT NULL,
  connection_name TEXT NOT NULL,
  user_identifier TEXT,             -- AI Client 标识或用户标识
  sql_text TEXT NOT NULL,
  sql_type TEXT NOT NULL,           -- SELECT|INSERT|UPDATE|DELETE|PROCEDURE|FUNCTION|DDL
  database_name TEXT,
  table_name TEXT,
  parameters TEXT,                  -- 参数列表 (JSON)
  execution_time_ms INTEGER,
  row_count INTEGER,
  status TEXT NOT NULL,             -- success|error
  error_message TEXT,
  client_ip TEXT,
  client_type TEXT,                 -- web_ui|mcp_client
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_connection ON audit_logs(connection_id);
CREATE INDEX idx_audit_user ON audit_logs(user_identifier);
CREATE INDEX idx_audit_status ON audit_logs(status);
CREATE INDEX idx_audit_sql_type ON audit_logs(sql_type);
```

#### 系统设置表 (settings)

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 默认设置
INSERT INTO settings (key, value, description) VALUES
  ('audit_retention_days', '30', '审计日志保留天数'),
  ('max_query_rows', '10000', '单次查询最大返回行数'),
  ('default_query_limit', '100', '默认查询限制'),
  ('query_timeout_ms', '30000', '查询超时时间 (ms)'),
  ('enable_slow_query_log', 'true', '是否启用慢查询日志'),
  ('slow_query_threshold_ms', '1000', '慢查询阈值 (ms)'),
  ('web_ui_enabled', 'true', '是否启用 Web UI'),
  ('mcp_transport', 'sse', 'MCP 传输方式：sse|stdio'),
  ('allow_ddl', 'false', '是否允许 DDL 操作'),
  ('require_confirmation_delete', 'true', 'DELETE 操作是否需要确认');
```

#### 查询历史表 (query_history)

```sql
CREATE TABLE query_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id TEXT NOT NULL,
  sql_text TEXT NOT NULL,
  parameters TEXT,                  -- 参数 (JSON)
  execution_time_ms INTEGER,
  row_count INTEGER,
  status TEXT NOT NULL,
  saved BOOLEAN DEFAULT 0,          -- 是否收藏
  tags TEXT,                        -- 标签 (JSON 数组)
  notes TEXT,                       -- 备注
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_history_created ON query_history(created_at);
CREATE INDEX idx_query_history_connection ON query_history(connection_id);
CREATE INDEX idx_query_history_saved ON query_history(saved);
```

#### 收藏 SQL 片段表 (saved_queries)

```sql
CREATE TABLE saved_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  connection_id TEXT,
  sql_text TEXT NOT NULL,
  description TEXT,
  parameters TEXT,                  -- 参数定义 (JSON)
  tags TEXT,                        -- 标签 (JSON 数组)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. 安全设计

### 5.1 认证与授权

#### MCP Client 认证
- **API Key 认证**: 通过 HTTP Header `X-API-Key` 传递
- **IP 白名单**: 配置允许访问的 IP 地址段
- **连接级别权限**: 每个连接可配置只读/读写权限

#### Web UI 访问控制
- 默认无认证 (内部网络使用)
- 可选启用简单密码保护
- 可选启用完整的用户管理系统 (后续扩展)

### 5.2 SQL 安全防护

| 安全措施 | 实现方式 |
|----------|----------|
| **参数化查询** | 所有用户输入必须通过参数传递，禁止字符串拼接 |
| **SQL 白名单** | 可配置允许的 SQL 类型 (如仅 SELECT) |
| **只读模式** | 连接级别配置，禁止 INSERT/UPDATE/DELETE/DDL |
| **DDL 限制** | 全局开关控制是否允许 DDL 操作 |
| **危险操作确认** | DELETE/UPDATE 无 WHERE 条件时强制确认 |
| **查询行数限制** | 限制单次查询最大返回行数 |
| **查询超时** | 防止长时间运行的查询占用资源 |

### 5.3 数据加密

| 数据类型 | 加密方式 |
|----------|----------|
| 数据库密码 | AES-256 加密存储 |
| SSL 连接 | TLS 1.2+ 传输加密 |
| 配置文件 | 敏感字段加密 |

### 5.4 安全配置项

```typescript
interface SecurityConfig {
  // API Key 认证
  apiKeyEnabled: boolean;
  apiKeys: string[];
  
  // IP 白名单
  ipWhitelist: string[];
  ipWhitelistEnabled: boolean;
  
  // SQL 限制
  maxQueryRows: number;
  queryTimeoutMs: number;
  allowDDL: boolean;
  requireDeleteConfirmation: boolean;
  
  // 审计
  auditEnabled: boolean;
  auditRetentionDays: number;
  logSlowQueries: boolean;
  slowQueryThresholdMs: number;
}
```

---

## 6. 部署设计

### 6.1 Docker 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                      1Panel 宿主机                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  docker-compose.yml                                   │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐ │   │
│  │  │ mcp-db-server   │  │ 数据卷                       │ │   │
│  │  │ - 应用容器       │  │ ./data:/app/data            │ │   │
│  │  │ - 端口 3000,3001 │  │ - system.db (系统数据库)     │ │   │
│  │  │ - 环境变量配置   │  │ - config/ (配置文件)         │ │   │
│  │  └─────────────────┘  └─────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 环境变量配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `NODE_ENV` | production | 运行环境 |
| `PORT` | 3000 | Web UI 端口 |
| `MCP_PORT` | 3001 | MCP SSE 端口 |
| `SYSTEM_DB_PATH` | /app/data/system.db | 系统数据库路径 |
| `WEB_UI_ENABLED` | true | 是否启用 Web UI |
| `MCP_TRANSPORT` | sse | MCP 传输方式 (sse/stdio) |
| `API_KEY` | - | API Key (可选) |
| `IP_WHITELIST` | - | IP 白名单 (逗号分隔) |
| `ENCRYPTION_KEY` | - | 密码加密密钥 (32 位) |
| `LOG_LEVEL` | info | 日志级别 |
| `AUDIT_ENABLED` | true | 是否启用审计日志 |
| `AUDIT_RETENTION_DAYS` | 30 | 审计日志保留天数 |

### 6.3 1Panel 应用包结构

```
mcp-database-server/
├── app.yml                 # 1Panel 应用定义
├── docker-compose.yml      # Docker Compose 配置
├── Dockerfile              # 镜像构建文件
├── data/
│   └── system.db           # 系统数据库 (首次启动创建)
└── scripts/
    ├── init.sh             # 初始化脚本
    └── backup.sh           # 备份脚本
```

### 6.4 一键部署脚本

```bash
#!/bin/bash
# 1Panel 应用安装脚本

# 创建应用目录
mkdir -p /opt/1panel/apps/mcp-database-server/data

# 生成加密密钥
ENCRYPTION_KEY=$(openssl rand -hex 32)

# 创建 docker-compose.yml
cat > /opt/1panel/apps/mcp-database-server/docker-compose.yml << EOF
version: '3.8'
services:
  mcp-db-server:
    image: registry.cn-beijing.aliyuncs.com/mcp-svr/mcp-database-server:latest
    container_name: mcp-database-server
    ports:
      - "3000:3000"
      - "3001:3001"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - SYSTEM_DB_PATH=/app/data/system.db
      - WEB_UI_ENABLED=true
      - MCP_TRANSPORT=sse
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    restart: unless-stopped
EOF

# 启动服务
cd /opt/1panel/apps/mcp-database-server
docker-compose up -d

echo "MCP Database Server 部署完成！"
echo "Web UI: http://<服务器 IP>:3000"
echo "MCP Endpoint: http://<服务器 IP>:3001/sse"
```

---

## 7. 项目结构

### 7.1 目录结构

```
mcp-database-server/
├── src/
│   ├── index.ts                    # 应用入口
│   ├── app.ts                      # Express 应用配置
│   ├── config/
│   │   ├── index.ts                # 配置加载
│   │   ├── database.ts             # 数据库配置
│   │   └── security.ts             # 安全配置
│   ├── database/
│   │   ├── system/
│   │   │   ├── index.ts            # 系统数据库初始化
│   │   │   ├── migrations/         # 数据库迁移
│   │   │   └── repositories/       # 数据访问层
│   │   ├── drivers/
│   │   │   ├── BaseDriver.ts       # 驱动基类
│   │   │   ├── MySQLDriver.ts      # MySQL 驱动
│   │   │   ├── PostgreSQLDriver.ts # PostgreSQL 驱动
│   │   │   ├── SQLServerDriver.ts  # SQL Server 驱动
│   │   │   ├── OracleDriver.ts     # Oracle 驱动
│   │   │   └── SQLiteDriver.ts     # SQLite 驱动
│   │   ├── ConnectionManager.ts    # 连接管理器
│   │   ├── QueryExecutor.ts        # SQL 执行器
│   │   └── MetadataService.ts      # 元数据服务
│   ├── services/
│   │   ├── AuditService.ts         # 审计服务
│   │   ├── TransactionService.ts   # 事务服务
│   │   ├── PaginationService.ts    # 分页服务
│   │   └── EncryptionService.ts    # 加密服务
│   ├── controllers/
│   │   ├── connections.controller.ts
│   │   ├── query.controller.ts
│   │   ├── metadata.controller.ts
│   │   ├── audit.controller.ts
│   │   └── settings.controller.ts
│   ├── routes/
│   │   └── index.ts                # 路由配置
│   ├── middleware/
│   │   ├── auth.middleware.ts      # 认证中间件
│   │   ├── audit.middleware.ts     # 审计中间件
│   │   └── error.middleware.ts     # 错误处理
│   ├── mcp/
│   │   ├── server.ts               # MCP Server
│   │   ├── tools/                  # MCP Tools
│   │   │   ├── sqlQuery.ts
│   │   │   ├── listTables.ts
│   │   │   ├── getTableSchema.ts
│   │   │   └── index.ts
│   │   └── resources/              # MCP Resources
│   │       └── database.ts
│   ├── utils/
│   │   ├── logger.ts               # 日志工具
│   │   ├── validator.ts            # SQL 验证
│   │   └── formatter.ts            # 结果格式化
│   └── types/
│       └── index.ts                # 类型定义
├── web/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard/
│   │   │   ├── Connections/
│   │   │   ├── Query/
│   │   │   ├── Data/
│   │   │   ├── Schema/
│   │   │   ├── Procedures/
│   │   │   ├── Audit/
│   │   │   └── Settings/
│   │   ├── components/
│   │   │   ├── SQLEditor/
│   │   │   ├── QueryResult/
│   │   │   ├── TableBrowser/
│   │   │   └── common/
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── stores/
│   │   │   └── connectionStore.ts
│   │   └── styles/
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── doc/
│   ├── DESIGN.md                   # 设计文档
│   ├── API.md                      # API 文档
│   └── DEPLOYMENT.md               # 部署文档
├── scripts/
│   ├── build.sh
│   └── deploy.sh
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 8. 开发计划

### 8.1 里程碑规划

| 阶段 | 任务 | 预计时间 | 交付物 |
|------|------|----------|--------|
| **Phase 1** | 项目初始化 | 1 天 | 项目框架、Docker 配置 |
| | - 项目 scaffolding | | |
| | - TypeScript 配置 | | |
| | - Docker 配置 | | |
| | - 系统数据库设计 | | |
| **Phase 2** | 后端核心 - 连接管理 | 1 天 | 连接管理器、MySQL/PG 驱动 |
| | - 系统数据库实现 | | |
| | - 连接管理器 | | |
| | - MySQL 驱动 | | |
| | - PostgreSQL 驱动 | | |
| **Phase 3** | 后端核心 - 查询执行 | 1 天 | SQL 执行器、审计服务 |
| | - SQL 执行器 | | |
| | - 审计服务 | | |
| | - 元数据服务 | | |
| | - 事务服务 | | |
| **Phase 4** | 更多数据库支持 | 1 天 | SQL Server、Oracle、SQLite 驱动 |
| | - SQL Server 驱动 | | |
| | - Oracle 驱动 | | |
| | - SQLite 驱动 | | |
| **Phase 5** | REST API 实现 | 1 天 | 完整 REST API |
| | - 连接管理 API | | |
| | - 查询执行 API | | |
| | - 元数据 API | | |
| | - 审计日志 API | | |
| **Phase 6** | Web UI - 基础框架 | 1 天 | React 框架、路由、布局 |
| | - React + TS 配置 | | |
| | - Ant Design 集成 | | |
| | - 路由和布局 | | |
| | - API 服务封装 | | |
| **Phase 7** | Web UI - 核心页面 | 2 天 | 连接管理、SQL 工作台、数据浏览 |
| | - 连接管理页面 | | |
| | - SQL 工作台 | | |
| | - 数据浏览 | | |
| | - 表结构查看 | | |
| **Phase 8** | Web UI - 高级功能 | 1 天 | 审计日志、系统设置 |
| | - 审计日志页面 | | |
| | - 存储过程管理 | | |
| | - 系统设置 | | |
| | - 仪表盘 | | |
| **Phase 9** | MCP 协议集成 | 1 天 | MCP Server、Tools、Resources |
| | - MCP Server 配置 | | |
| | - MCP Tools 实现 | | |
| | - MCP Resources 实现 | | |
| | - Stdio/SSE 传输 | | |
| **Phase 10** | 测试和优化 | 1 天 | 测试用例、性能优化 |
| | - 单元测试 | | |
| | - 集成测试 | | |
| | - 性能优化 | | |
| | - 文档完善 | | |
| **总计** | | **11 天** | |

### 8.2 开发优先级

```
优先级 P0 (必须实现):
├── 连接管理器
├── MySQL/PostgreSQL 驱动
├── SQL 查询执行
├── 审计日志
├── 连接管理 API
├── 连接管理 UI
└── SQL 工作台 UI

优先级 P1 (重要):
├── SQL Server/Oracle 驱动
├── 元数据查询
├── 数据浏览 UI
├── 表结构查看 UI
├── MCP Tools 实现
└── Docker 部署

优先级 P2 (可选):
├── 存储过程执行
├── 事务管理
├── 审计统计图表
├── 系统设置 UI
└── MCP Resources
```

---

## 9. 测试策略

### 9.1 单元测试

- 数据库驱动测试
- 连接管理器测试
- SQL 执行器测试
- 审计服务测试

### 9.2 集成测试

- REST API 测试
- MCP 协议测试
- 数据库连接测试

### 9.3 E2E 测试

- Web UI 功能测试
- 部署流程测试

---

## 10. 监控与运维

### 10.1 健康检查端点

```
GET /health
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "database": {
    "system": "connected",
    "connections": {
      "mysql_prod": "connected",
      "pg_dev": "error"
    }
  },
  "memory": {
    "used": "128MB",
    "total": "512MB"
  }
}
```

### 10.2 日志级别

| 级别 | 说明 | 示例 |
|------|------|------|
| error | 错误日志 | 数据库连接失败、SQL 执行错误 |
| warn | 警告日志 | 慢查询、连接池耗尽 |
| info | 信息日志 | 连接创建、查询执行 |
| debug | 调试日志 | SQL 详情、参数值 |

### 10.3 备份策略

- 系统数据库每日自动备份
- 连接配置可手动导出
- 审计日志定期归档

---

## 11. 扩展性设计

### 11.1 新增数据库支持

通过实现 `BaseDriver` 接口即可添加新的数据库驱动:

```typescript
interface DatabaseDriver {
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: any[]): Promise<QueryResult>;
  getTables(schema?: string): Promise<TableInfo[]>;
  getTableSchema(table: string): Promise<TableSchema>;
  // ...
}
```

### 11.2 未来扩展

- 支持 Redis、MongoDB 等非关系型数据库
- 多租户支持
- 完整的用户权限管理系统
- 数据同步/迁移工具
- SQL 自动补全和优化建议

---

## 附录

### A. 依赖包清单

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "express": "^4.18.0",
    "better-sqlite3": "^9.0.0",
    "mysql2": "^3.6.0",
    "pg": "^8.11.0",
    "tedious": "latest",
    "oracledb": "^6.0.0",
    "crypto-js": "^4.1.0",
    "pino": "^8.0.0",
    "zod": "^3.22.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "vitest": "^1.0.0"
  }
}
```

### B. 参考资料

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Express.js Documentation](https://expressjs.com/)
- [Ant Design Documentation](https://ant.design/)
- [1Panel Documentation](https://1panel.cn/)

---

*文档版本：1.0.0*
*最后更新：2024-01-01*
