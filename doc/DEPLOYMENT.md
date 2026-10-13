# MCP Database Server 部署文档

## 1. 部署概述

本文档介绍如何在 1Panel 中部署 MCP Database Server。

### 1.1 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Linux (推荐 Ubuntu 20.04+) |
| CPU | 2 核 + |
| 内存 | 2GB+ (推荐 4GB+) |
| 磁盘 | 10GB+ 可用空间 |
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| 1Panel | 最新版本 |

### 1.2 端口需求

| 端口 | 用途 | 是否需要公网 |
|------|------|------------|
| 3000 | Web UI | 内网访问即可 |
| 3001 | MCP SSE | 根据 AI 平台位置决定 |

---

## 2. 1Panel 一键部署

### 2.1 应用包结构

```
mcp-database-server/
├── app.yml                 # 1Panel 应用定义文件
├── docker-compose.yml      # Docker Compose 配置
├── Dockerfile              # Docker 镜像构建文件
├── README.md               # 应用说明
└── scripts/
    ├── init.sh             # 初始化脚本
    └── backup.sh           # 备份脚本
```

### 2.2 应用定义文件 (app.yml)

```yaml
name: mcp-database-server
tags:
  - 开发工具
  - 数据库
  - AI 工具
short_desc: MCP 数据库服务器 - 为 AI 开发平台提供数据库连接服务
description: |
  MCP Database Server 是一个基于 Model Context Protocol 的数据库连接服务。
  
  功能特性:
  - 支持 MySQL、PostgreSQL、SQL Server、Oracle、SQLite
  - 提供 Web UI 管理界面
  - 标准 MCP 协议接口
  - 完整的审计日志
  - 连接池管理
  - 安全控制
  
  适用场景:
  - AI 开发平台数据库连接
  - 内部数据库管理工具
  - 数据库查询服务

type: application
version: 1.0.0
crossVersionUpdate: true
require: docker-compose >= 2.0

versions:
  - version: 1.0.0
    type: docker
    docker_compose: |
      services:
        mcp-db-server:
          image: registry.cn-beijing.aliyuncs.com/mcp-svr/mcp-database-server:1.0.0
          container_name: mcp-database-server-${RANDOM_PORT}
          ports:
            - "${WEB_PORT}:3000"
            - "${MCP_PORT}:3001"
          volumes:
            - ./data:/app/data
          environment:
            - NODE_ENV=production
            - SYSTEM_DB_PATH=/app/data/system.db
            - WEB_UI_ENABLED=true
            - MCP_TRANSPORT=${MCP_TRANSPORT}
            - ENCRYPTION_KEY=${ENCRYPTION_KEY}
            - LOG_LEVEL=${LOG_LEVEL}
          networks:
            - mcp-network
          restart: unless-stopped
          healthcheck:
            test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 30s
      
      networks:
        mcp-network:
          driver: bridge

    params:
      - key: WEB_PORT
        label: Web UI 端口
        type: number
        default: 3000
        required: true
        rule: "^[0-9]{1,5}$"
      
      - key: MCP_PORT
        label: MCP 服务端口
        type: number
        default: 3001
        required: true
        rule: "^[0-9]{1,5}$"
      
      - key: MCP_TRANSPORT
        label: MCP 传输方式
        type: select
        default: sse
        required: true
        options:
          - value: sse
            label: SSE (推荐 - HTTP 长连接)
          - value: stdio
            label: Stdio (本地进程调用)
      
      - key: ENCRYPTION_KEY
        label: 密码加密密钥
        type: text
        default: ""
        required: false
        description: "32 位随机字符串，用于加密数据库密码。留空则自动生成"
      
      - key: LOG_LEVEL
        label: 日志级别
        type: select
        default: info
        required: true
        options:
          - value: error
            label: ERROR - 仅错误日志
          - value: warn
            label: WARN - 警告及以上
          - value: info
            label: INFO - 信息及以上 (推荐)
          - value: debug
            label: DEBUG - 调试日志 (开发环境)

    containers:
      - name: mcp-db-server
        image: registry.cn-beijing.aliyuncs.com/mcp-svr/mcp-database-server:1.0.0
        ports:
          - "${WEB_PORT}:3000"
          - "${MCP_PORT}:3001"
        volumes:
          - ./data:/app/data
```

### 2.3 初始化脚本 (scripts/init.sh)

```bash
#!/bin/bash

set -e

APP_DIR="/opt/1panel/apps/mcp-database-server"
DATA_DIR="$APP_DIR/data"

echo "=== MCP Database Server 初始化 ==="

# 创建数据目录
mkdir -p "$DATA_DIR"

# 生成加密密钥 (如果未提供)
if [ -z "$ENCRYPTION_KEY" ]; then
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    echo "自动生成加密密钥：$ENCRYPTION_KEY"
fi

# 保存加密密钥到文件
echo "$ENCRYPTION_KEY" > "$DATA_DIR/.encryption_key"
chmod 600 "$DATA_DIR/.encryption_key"

# 创建系统数据库初始化标记
touch "$DATA_DIR/.initialized"

echo "=== 初始化完成 ==="
echo "Web UI: http://<服务器 IP>:$WEB_PORT"
echo "MCP Endpoint: http://<服务器 IP>:$MCP_PORT/sse"
echo ""
echo "请妥善保管加密密钥：$ENCRYPTION_KEY"
echo "密钥已保存到：$DATA_DIR/.encryption_key"
```

### 2.4 备份脚本 (scripts/backup.sh)

```bash
#!/bin/bash

set -e

APP_DIR="/opt/1panel/apps/mcp-database-server"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== 开始备份 MCP Database Server ==="

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份系统数据库
cp "$DATA_DIR/system.db" "$BACKUP_DIR/system.db.$TIMESTAMP"

# 备份配置文件 (如果有)
if [ -d "$DATA_DIR/config" ]; then
    cp -r "$DATA_DIR/config" "$BACKUP_DIR/config.$TIMESTAMP"
fi

# 压缩备份
cd "$BACKUP_DIR"
tar -czf "mcp-db-server-backup.$TIMESTAMP.tar.gz" system.db.$TIMESTAMP config.$TIMESTAMP 2>/dev/null || \
tar -czf "mcp-db-server-backup.$TIMESTAMP.tar.gz" system.db.$TIMESTAMP

# 清理临时文件
rm -f system.db.$TIMESTAMP config.$TIMESTAMP 2>/dev/null

# 保留最近 30 天的备份
find "$BACKUP_DIR" -name "mcp-db-server-backup.*.tar.gz" -mtime +30 -delete

echo "=== 备份完成 ==="
echo "备份文件：$BACKUP_DIR/mcp-db-server-backup.$TIMESTAMP.tar.gz"
```

### 2.5 在 1Panel 中安装

1. **上传应用包**
   ```bash
   # 将应用包上传到 1Panel 应用目录
   cp -r mcp-database-server /opt/1panel/appstore/
   ```

2. **在 1Panel 界面安装**
   - 登录 1Panel 管理界面
   - 进入「应用商店」
   - 找到「MCP Database Server」
   - 点击「安装」
   - 配置端口和参数
   - 点击「确认」

3. **验证安装**
   ```bash
   # 查看容器状态
   docker ps | grep mcp-database-server
   
   # 查看日志
   docker logs -f mcp-database-server
   ```

---

## 3. Docker 手动部署

### 3.1 创建项目目录

```bash
mkdir -p /opt/mcp-database-server/data
cd /opt/mcp-database-server
```

### 3.2 创建 docker-compose.yml

```yaml
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
      - ENCRYPTION_KEY=your-32-char-encryption-key-here
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

### 3.3 生成加密密钥

```bash
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "加密密钥：$ENCRYPTION_KEY"
```

### 3.4 启动服务

```bash
# 编辑 docker-compose.yml，填入加密密钥
vim docker-compose.yml

# 启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f
```

---

## 4. 源码部署 (开发环境)

### 4.1 环境准备

```bash
# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 验证安装
node -v  # 应 >= 18.0.0
npm -v
```

### 4.2 克隆项目

```bash
git clone <repository-url> mcp-database-server
cd mcp-database-server
```

### 4.3 安装依赖

```bash
# 安装后端依赖
npm install

# 安装 Web UI 依赖
cd web && npm install && cd ..
```

### 4.4 构建项目

```bash
# 构建后端
npm run build

# 构建 Web UI
npm run build:web
```

### 4.5 配置环境变量

创建 `.env` 文件:

```bash
NODE_ENV=development
PORT=3000
MCP_PORT=3001
SYSTEM_DB_PATH=./data/system.db
WEB_UI_ENABLED=true
MCP_TRANSPORT=sse
ENCRYPTION_KEY=your-32-char-encryption-key-here
LOG_LEVEL=debug
```

### 4.6 运行服务

```bash
# 开发模式 (热重载)
npm run dev

# 生产模式
npm start
```

---

## 5. 配置管理

### 5.1 环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | production | 运行环境 (development/production) |
| `PORT` | 3000 | Web UI 和 REST API 端口 |
| `MCP_PORT` | 3001 | MCP SSE 端点端口 |
| `SYSTEM_DB_PATH` | /app/data/system.db | 系统 SQLite 数据库路径 |
| `WEB_UI_ENABLED` | true | 是否启用 Web UI |
| `MCP_TRANSPORT` | sse | MCP 传输方式 (sse/stdio) |
| `ENCRYPTION_KEY` | - | 32 位加密密钥 (必需) |
| `LOG_LEVEL` | info | 日志级别 (error/warn/info/debug) |
| `AUDIT_ENABLED` | true | 是否启用审计日志 |
| `AUDIT_RETENTION_DAYS` | 30 | 审计日志保留天数 |
| `MAX_QUERY_ROWS` | 10000 | 单次查询最大返回行数 |
| `QUERY_TIMEOUT_MS` | 30000 | 查询超时时间 (毫秒) |

### 5.2 生成加密密钥

```bash
# Linux/Mac
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## 6. 运维管理

### 6.1 查看服务状态

```bash
# Docker 部署
docker ps | grep mcp-database-server
docker stats mcp-database-server

# 查看日志
docker logs mcp-database-server
docker logs -f mcp-database-server  # 实时日志
```

### 6.2 服务重启

```bash
# Docker 部署
docker-compose restart

# 或
docker restart mcp-database-server
```

### 6.3 服务停止

```bash
docker-compose down
```

### 6.4 数据备份

```bash
# 手动备份系统数据库
cp /opt/mcp-database-server/data/system.db ./system.db.backup.$(date +%Y%m%d)

# 或使用备份脚本
./scripts/backup.sh
```

### 6.5 数据恢复

```bash
# 停止服务
docker-compose down

# 恢复系统数据库
cp ./system.db.backup.20240115 /opt/mcp-database-server/data/system.db

# 启动服务
docker-compose up -d
```

### 6.6 日志管理

```bash
# 查看实时日志
docker logs -f mcp-database-server

# 查看最近 100 行日志
docker logs --tail 100 mcp-database-server

# 导出日志
docker logs mcp-database-server > mcp-db-server.log
```

---

## 7. 安全配置

### 7.1 防火墙配置

```bash
# 仅允许内网访问
ufw allow from 203.0.113.10/24 to any port 3000
ufw allow from 203.0.113.10/24 to any port 3001

# 或仅允许特定 IP
ufw allow from 203.0.113.10 to any port 3000
ufw allow from 203.0.113.10 to any port 3001
```

### 7.2 启用 API Key 认证

在环境变量中添加:

```bash
API_KEY=YOUR_SECRET
IP_WHITELIST=203.0.113.10,203.0.113.10
```

### 7.3 SSL/TLS 配置

如果使用 Nginx 反向代理:

```nginx
server {
    listen 443 ssl;
    server_name mcp.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /sse {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache off;
        proxy_buffering off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

---

## 8. 监控与告警

### 8.1 健康检查

```bash
# 检查服务健康状态
curl http://localhost:3000/api/health

# 预期响应
{
  "status": "ok",
  "timestamp": "...",
  "version": "1.0.0"
}
```

### 8.2 Prometheus 监控 (可选)

添加 Exporter 配置:

```yaml
# docker-compose.yml
services:
  mcp-db-server:
    # ... 其他配置
    environment:
      - METRICS_ENABLED=true
      - METRICS_PORT=9090

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

### 8.3 告警规则

```yaml
# prometheus.yml
groups:
  - name: mcp-alerts
    rules:
      - alert: ServiceDown
        expr: up{job="mcp-db-server"} == 0
        for: 1m
        annotations:
          summary: "MCP Database Server 服务宕机"
      
      - alert: HighErrorRate
        expr: rate(http_requests_total{status="500"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "MCP Database Server 错误率过高"
```

---

## 9. 故障排查

### 9.1 常见问题

**问题 1: 容器启动失败**

```bash
# 查看容器日志
docker logs mcp-database-server

# 检查端口占用
netstat -tlnp | grep 3000
netstat -tlnp | grep 3001

# 检查磁盘空间
df -h
```

**问题 2: 无法连接数据库**

- 检查数据库连接配置是否正确
- 检查数据库服务是否运行
- 检查防火墙是否放行
- 查看审计日志了解错误详情

**问题 3: Web UI 无法访问**

```bash
# 检查容器是否运行
docker ps | grep mcp-database-server

# 检查端口映射
docker port mcp-database-server

# 检查防火墙
ufw status
```

### 9.2 日志级别调整

临时提高日志级别进行调试:

```bash
docker exec -it mcp-database-server sh
export LOG_LEVEL=debug
# 重启服务
```

---

## 10. 升级指南

### 10.1 Docker 部署升级

```bash
# 备份数据
./scripts/backup.sh

# 停止服务
docker-compose down

# 拉取新镜像
docker-compose pull

# 启动服务
docker-compose up -d

# 验证升级
curl http://localhost:3000/api/version
```

### 10.2 源码部署升级

```bash
# 拉取新代码
git pull

# 安装新依赖
npm install

# 重新构建
npm run build
npm run build:web

# 重启服务
pm2 restart mcp-db-server
```

---

## 11. 性能优化

### 11.1 连接池配置

根据业务负载调整连接池大小:

```yaml
environment:
  - POOL_MIN=5      # 最小连接数
  - POOL_MAX=20     # 最大连接数
  - POOL_IDLE_TIMEOUT=60000  # 空闲超时
```

### 11.2 内存优化

限制容器内存使用:

```yaml
# docker-compose.yml
services:
  mcp-db-server:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### 11.3 数据库优化

- 定期清理审计日志
- 为常用查询字段添加索引
- 使用连接池复用连接

---

## 附录

### A. 目录结构说明

```
/opt/mcp-database-server/
├── data/                    # 数据目录
│   ├── system.db           # 系统 SQLite 数据库
│   ├── .encryption_key     # 加密密钥文件
│   └── .initialized        # 初始化标记
├── backups/                 # 备份目录
└── docker-compose.yml       # Docker Compose 配置
```

### B. 常用命令速查

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps

# 进入容器
docker-compose exec mcp-db-server sh

# 备份数据
docker-compose exec mcp-db-server /app/scripts/backup.sh
```

### C. 联系方式

- 项目仓库：[GitHub](https://github.com/your-org/mcp-database-server)
- 问题反馈：[Issues](https://github.com/your-org/mcp-database-server/issues)

---

*最后更新：2024-01-01*
