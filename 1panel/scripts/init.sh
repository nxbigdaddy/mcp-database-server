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
