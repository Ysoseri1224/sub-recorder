#!/bin/sh
# 修复 volume mount 时 root 创建目录导致 app 用户无权写入的问题
DB_DIR=$(dirname "${DATABASE_PATH:-/app/data/subscriptions.db}")
mkdir -p "$DB_DIR"
chown app:app "$DB_DIR"

exec su-exec app "$@"
