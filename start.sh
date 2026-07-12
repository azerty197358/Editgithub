#!/bin/bash
set -e

echo "=========================================="
echo "🤖 DevMind - Starting..."
echo "=========================================="

# Set defaults
export PORT=${PORT:-8000}
export LOCAL_BACKEND_API_KEY=${LOCAL_BACKEND_API_KEY:-$(openssl rand -base64 32)}

echo "Port: $PORT"
echo "API Key: ${LOCAL_BACKEND_API_KEY:0:20}..."

# Start Agent Canvas
exec agent-canvas --public
