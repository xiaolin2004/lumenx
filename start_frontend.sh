#!/bin/bash

echo "========================================"
echo "Starting Frontend (Next.js)..."
echo "Port: ${FRONTEND_PORT:-3001}"
echo "========================================"

cd frontend

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
    echo "✅ Dependencies installed."
fi

PORT="${FRONTEND_PORT:-3001}" npm run dev -- --hostname 127.0.0.1 --port "${FRONTEND_PORT:-3001}"
