# MCP Database Server 文档索引

## 项目简介

MCP Database Server 是一个基于 Model Context Protocol (MCP) 标准的数据库连接服务，为公司内部 AI 开发平台提供统一的数据库访问接口。

### 核心特性

- ✅ **多数据库支持**: MySQL、PostgreSQL、SQL Server、Oracle、SQLite
- ✅ **Web UI 管理界面**: 功能完善的数据库管理工具
- ✅ **MCP 协议**: 标准 MCP 接口，兼容各大 AI 开发平台
- ✅ **审计日志**: 完整的 SQL 执行日志和统计分析
- ✅ **连接池管理**: 高效的数据库连接管理
- ✅ **安全控制**: 只读模式、SQL 白名单、API Key 认证
- ✅ **1Panel 部署**: 支持一键部署
- ✅ **无认证模式**: 内部网络可直接使用

---

## 文档目录

### 📘 设计文档
- [完整设计文档](./DESIGN.md)
  - 系统架构
  - 功能模块设计
  - 数据库设计
  - 安全设计
  - 技术栈选型

### 📗 API 文档
- [REST API 文档](./API.md)
  - 连接管理 API
  - SQL 执行 API
  - 元数据查询 API
  - 审计日志 API
  - 系统管理 API

### 📙 部署文档
- [部署指南](./DEPLOYMENT.md)
  - 1Panel 一键部署
  - Docker 手动部署
  - 源码部署
  - 配置说明
  - 运维管理

### 📕 MCP 协议文档
- [MCP 协议集成](./MCP_PROTOCOL.md)
  - MCP Tools 定义
  - MCP Resources 实现
  - AI 平台集成示例
  - 安全最佳实践

---

## 快速开始

### 1. 1Panel 部署 (推荐)

```bash
# 下载应用包
git clone <repository-url> mcp-database-server
cd mcp-database-server

# 上传到 1Panel 应用目录
cp -r . /opt/1panel/appstore/mcp-database-server/

# 在 1Panel 界面安装
# 访问 1Panel -> 应用商店 -> MCP Database Server -> 安装
```

### 2. Docker 部署

```bash
# 创建 docker-compose.yml
cat > docker-compose.yml << 'EOF'
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
      - ENCRYPTION_KEY=$(openssl rand -hex 32)
    restart: unless-stopped
EOF

# 启动服务
docker-compose up -d

# 访问 Web UI
# http://localhost:3000
```

### 3. 开发环境部署

```bash
# 克隆项目
git clone <repository-url> mcp-database-server
cd mcp-database-server

# 安装依赖
npm install
cd web && npm install && cd ..

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动开发服务
npm run dev

# 访问 Web UI
# http://localhost:3000
```

---

## 访问地址

部署完成后:

| 服务 | 地址 | 说明 |
|------|------|------|
| Web UI | http://localhost:3000 | 数据库管理界面 |
| REST API | http://localhost:3000/api | RESTful API |
| MCP SSE | http://localhost:3001/sse | AI 平台 MCP 连接 |
| 健康检查 | http://localhost:3000/api/health | 服务状态检查 |

---

## 使用示例

### 1. Web UI 使用

1. 访问 http://localhost:3000
2. 进入「连接管理」页面
3. 点击「新建连接」
4. 填写数据库信息并测试连接
5. 保存后在 SQL 工作台执行查询

### 2. AI 平台集成 (Claude Desktop)

编辑配置文件 `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "database": {
      "url": "http://203.0.113.10:3001/sse",
      "transport": "sse"
    }
  }
}
```

然后在 Claude 中可以直接使用自然语言查询数据库:

> "查看 prod_mysql 数据库中 users 表的结构"
> "查询最近注册的 10 个用户"

### 3. REST API 调用

```bash
# 获取连接列表
curl http://localhost:3000/api/connections

# 执行 SQL 查询
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "connection": "prod_mysql",
    "sql": "SELECT * FROM users LIMIT 10"
  }'

# 获取表结构
curl http://localhost:3000/api/prod_mysql/schema/users
```

---

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    AI 开发平台                            │
│              (Claude Desktop / 其他 MCP Client)           │
└────────────────────┬────────────────────────────────────┘
                     │ MCP Protocol (SSE/Stdio)
┌────────────────────▼────────────────────────────────────┐
│              MCP Database Server                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Web UI (React + Ant Design)                        ││
│  │  - 连接管理  - SQL 工作台  - 数据浏览                 ││
│  │  - 表结构    - 审计日志    - 系统设置                ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  REST API (Express)                                 ││
│  │  - 连接管理  - SQL 执行   - 元数据查询               ││
│  │  - 审计日志  - 系统管理                              ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  MCP Server (@modelcontextprotocol/sdk)             ││
│  │  - Tools (sql_query, list_tables, ...)             ││
│  │  - Resources (db://...)                             ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  Core Services                                      ││
│  │  - Connection Manager (连接池管理)                  ││
│  │  - Query Executor (SQL 执行引擎)                    ││
│  │  - Audit Service (审计日志)                         ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  System Database (SQLite)                           ││
│  │  - 连接配置  - 审计日志  - 系统设置                  ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  Database Drivers                                   ││
│  │  MySQL │ PostgreSQL │ SQL Server │ Oracle │ SQLite  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │  MySQL  │ │   MSSQL │ │ Oracle  │
    │ 业务库   │ │  业务库  │ │ 业务库   │
    └─────────┘ └─────────┘ └─────────┘
```

---

## 技术栈

| 组件 | 技术 |
|------|------|
| **后端** | Node.js 18+, TypeScript 5, Express 4 |
| **MCP SDK** | @modelcontextprotocol/sdk |
| **数据库驱动** | mysql2, pg, tedious, oracledb, better-sqlite3 |
| **系统数据库** | SQLite (better-sqlite3) |
| **Web UI** | React 18, TypeScript, Ant Design 5, TailwindCSS |
| **部署** | Docker, Docker Compose, 1Panel |

---

## 开发计划

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 项目初始化 + 基础架构 | 📋 待开发 |
| Phase 2 | 连接管理器 + MySQL/PG 驱动 | 📋 待开发 |
| Phase 3 | SQL 执行器 + 审计服务 | 📋 待开发 |
| Phase 4 | 更多数据库支持 (MSSQL/Oracle/SQLite) | 📋 待开发 |
| Phase 5 | REST API 实现 | 📋 待开发 |
| Phase 6 | Web UI 基础框架 | 📋 待开发 |
| Phase 7 | Web UI 核心页面 | 📋 待开发 |
| Phase 8 | Web UI 高级功能 | 📋 待开发 |
| Phase 9 | MCP 协议集成 | 📋 待开发 |
| Phase 10 | 测试和优化 | 📋 待开发 |

---

## 常见问题

### Q: 如何配置数据库连接？
A: 通过 Web UI 的「连接管理」页面进行配置，支持动态添加、编辑、删除。

### Q: 审计日志存储在哪里？
A: 存储在系统 SQLite 数据库 (`system.db`) 的 `audit_logs` 表中。

### Q: 如何启用 API Key 认证？
A: 设置环境变量 `API_KEY=YOUR_SECRET` 和 `IP_WHITELIST=203.0.113.10`。

### Q: 支持哪些 MCP 客户端？
A: 支持任何兼容 MCP 协议的客户端，包括 Claude Desktop、其他大模型开发平台等。

### Q: 如何备份配置和日志？
A: 备份 `data/system.db` 文件即可，或使用提供的备份脚本。

---

## 许可证

内部使用，请勿外传。

---

## 联系方式

- 项目仓库：[GitHub](https://github.com/your-org/mcp-database-server)
- 问题反馈：[Issues](https://github.com/your-org/mcp-database-server/issues)

---

*最后更新：2024-01-01*
