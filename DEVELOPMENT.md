# MCP Database Server 开发指南

## 项目结构

```
mcp-database-server/
├── src/                          # 后端源代码
│   ├── config/                   # 配置管理
│   ├── controllers/              # API 控制器
│   ├── database/                 # 数据库层
│   │   ├── drivers/              # 数据库驱动
│   │   ├── system/               # 系统数据库 (SQLite)
│   │   └── ConnectionManager.ts  # 连接管理器
│   ├── mcp/                      # MCP Server
│   ├── middleware/               # 中间件
│   ├── routes/                   # 路由配置
│   ├── services/                 # 业务服务
│   ├── types/                    # TypeScript 类型定义
│   ├── utils/                    # 工具函数
│   ├── app.ts                    # Express 应用
│   └── index.ts                  # 入口文件
├── web/                          # Web UI 源代码
│   ├── src/
│   │   ├── pages/                # 页面组件
│   │   ├── services/             # API 服务
│   │   ├── stores/               # 状态管理
│   │   ├── App.tsx               # 应用组件
│   │   └── main.tsx              # 入口文件
│   └── package.json
├── docker/                       # Docker 配置
├── 1panel/                       # 1Panel 应用包
└── doc/                          # 文档
```

## 开发环境准备

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装 Web UI 依赖
cd web && npm install && cd ..
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# 开发环境配置
NODE_ENV=development
PORT=3000
MCP_PORT=3001
SYSTEM_DB_PATH=./data/system.db
ENCRYPTION_KEY=your-32-char-encryption-key-here
LOG_LEVEL=debug
```

### 3. 启动开发服务器

```bash
# 方式 1: 同时启动后端和前端 (推荐)
npm run dev

# 方式 2: 分别启动
# 终端 1 - 后端
npm run dev

# 终端 2 - 前端
cd web && npm run dev
```

访问地址:
- Web UI: http://localhost:3000 (后端代理) 或 http://localhost:3002 (前端开发服务器)
- API: http://localhost:3000/api
- MCP SSE: http://localhost:3001/sse

## 开发任务

### 已完成 ✅

1. **后端核心功能**
   - 系统数据库 (SQLite) 设计和实现
   - 连接管理器 (ConnectionManager)
   - MySQL 和 PostgreSQL 驱动
   - SQL 执行器 (QueryExecutor)
   - 审计服务 (AuditService)
   - 元数据服务 (MetadataService)
   - 完整的 REST API
   - MCP Server (Tools + Resources)

2. **Web UI 基础**
   - React + Ant Design 框架
   - 仪表盘页面
   - 连接管理页面
   - SQL 工作台
   - 审计日志页面
   - 系统设置页面

3. **部署配置**
   - Docker 配置
   - 1Panel 应用包
   - 完整文档

### 待开发 📋

1. **数据库驱动完善**
   - SQL Server 驱动 (`src/database/drivers/SQLServerDriver.ts`)
   - Oracle 驱动 (`src/database/drivers/OracleDriver.ts`)
   - SQLite 驱动 (`src/database/drivers/SQLiteDriver.ts`)

2. **Web UI 功能完善**
   - 数据浏览页面完整功能 (`web/src/pages/Data.tsx`)
   - 表结构页面完整功能 (`web/src/pages/Schema.tsx`)
   - 存储过程管理页面
   - 更多图表和统计功能

3. **测试**
   - 单元测试 (Vitest)
   - 集成测试
   - E2E 测试

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器

# 代码质量
npm run lint             # ESLint 检查

# 测试
npm run test             # 运行测试
npm run test:ui          # 测试界面

# Docker
docker-compose up -d     # 启动 Docker 容器
docker-compose down      # 停止 Docker 容器
docker-compose logs -f   # 查看日志
```

## 添加新的数据库驱动

1. 创建驱动文件 `src/database/drivers/YourDatabaseDriver.ts`:

```typescript
import { BaseDriver } from './BaseDriver';
import type { /* 类型定义 */ } from '@/types';

export class YourDatabaseDriver extends BaseDriver {
  async connect(): Promise<void> {
    // 实现连接逻辑
  }

  async disconnect(): Promise<void> {
    // 实现断开连接逻辑
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    // 实现查询逻辑
  }

  // ... 实现其他必需方法
}
```

2. 在 `src/database/drivers/index.ts` 中注册:

```typescript
import { YourDatabaseDriver } from './YourDatabaseDriver';

export class DriverFactory {
  static create(config: DatabaseConfig): BaseDriver {
    switch (config.type) {
      case 'your_database':
        return new YourDatabaseDriver(config);
      // ...
    }
  }
}
```

3. 更新 `src/types/index.ts` 中的 `DatabaseType`:

```typescript
export type DatabaseType = 'mysql' | 'postgresql' | 'sqlserver' | 'oracle' | 'sqlite' | 'your_database';
```

## 添加新的 API 端点

1. 创建或编辑控制器 `src/controllers/your.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

export class YourController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      // 实现逻辑
      res.json({ success: true, data: [] });
    } catch (error) {
      next(error);
    }
  }
}

export const yourController = new YourController();
```

2. 在 `src/routes/index.ts` 中添加路由:

```typescript
import { yourController } from '@/controllers';

router.get('/your-endpoint', yourController.list.bind(yourController));
```

## 添加新的 Web UI 页面

1. 创建页面组件 `web/src/pages/YourPage.tsx`:

```typescript
export default function YourPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">页面标题</h1>
      {/* 页面内容 */}
    </div>
  );
}
```

2. 在 `web/src/App.tsx` 中添加路由:

```typescript
import YourPage from './pages/YourPage';

<Route path="/your-path" element={<YourPage />} />
```

3. 在侧边栏添加导航链接:

```typescript
<li>
  <a href="/your-path" className="block px-4 py-2 ...">
    📄 页面名称
  </a>
</li>
```

## 调试技巧

### 后端调试

1. 使用 VS Code 调试配置 (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "runtimeExecutable": "nodemon",
      "runtimeArgs": ["--exec", "tsx"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  ]
}
```

2. 查看日志:

```bash
# 开发环境日志级别设置为 debug
LOG_LEVEL=debug npm run dev
```

### 前端调试

1. 使用 React DevTools 扩展

2. 在浏览器开发者工具中查看 Network 请求

3. 前端开发服务器代理配置 (`web/vite.config.ts`):

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
},
```

## 数据库设计

### 系统数据库表

1. **connections** - 数据库连接配置
2. **audit_logs** - SQL 执行日志
3. **settings** - 系统设置
4. **query_history** - 查询历史
5. **saved_queries** - 收藏的 SQL 片段

详细表结构见 `src/database/system/index.ts`

## API 文档

完整的 API 文档见 `doc/API.md`

主要端点:
- `GET /api/connections` - 获取连接列表
- `POST /api/connections` - 创建连接
- `POST /api/query` - 执行 SQL
- `GET /api/:connectionId/tables` - 获取表列表
- `GET /api/audit/logs` - 查询审计日志

## MCP Tools

实现的 MCP Tools:
- `sql_query` - 执行 SQL 查询
- `list_databases` - 获取数据库列表
- `list_tables` - 获取表列表
- `get_table_schema` - 获取表结构
- `get_indexes` - 获取索引信息
- `execute_procedure` - 执行存储过程
- `begin_transaction` - 开始事务
- `commit_transaction` - 提交事务
- `rollback_transaction` - 回滚事务

详细文档见 `doc/MCP_PROTOCOL.md`

## 部署

### Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 1Panel 部署

1. 将 `1panel` 目录上传到 1Panel 应用商店
2. 在 1Panel 界面安装应用
3. 配置端口和参数

详细步骤见 `doc/DEPLOYMENT.md`

## 故障排查

### 常见问题

1. **端口冲突**
   - 修改 `.env` 中的 `PORT` 和 `MCP_PORT` 值

2. **加密密钥未配置**
   - 生成 32 位随机字符串: `openssl rand -hex 32`
   - 添加到 `.env`: `ENCRYPTION_KEY=your-key`

3. **数据库连接失败**
   - 检查数据库服务是否运行
   - 检查网络连接
   - 查看审计日志了解详细错误

4. **Web UI 无法访问**
   - 检查后端服务是否启动
   - 查看浏览器控制台错误
   - 检查防火墙设置

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License

---

*最后更新：2024-01-01*
