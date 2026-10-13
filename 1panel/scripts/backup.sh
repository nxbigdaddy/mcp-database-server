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
