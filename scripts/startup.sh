#!/bin/bash
set -e

echo "=================================="
echo "Starting OpenHands Agent Canvas"
echo "=================================="

# Add uv to PATH
export PATH="/root/.local/bin:$HOME/.local/bin:$PATH"

# Check if uv is installed
if ! command -v uvx &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="/root/.local/bin:$HOME/.local/bin:$PATH"
fi

# Verify uv is available
echo "uv version: $(uv --version 2>/dev/null || echo 'not found')"

# Check if API key is set
if [ -z "$LOCAL_BACKEND_API_KEY" ]; then
    echo "WARNING: LOCAL_BACKEND_API_KEY not set. Generating a random key..."
    export LOCAL_BACKEND_API_KEY=$(openssl rand -base64 32)
    echo "Generated API Key: $LOCAL_BACKEND_API_KEY"
    echo "IMPORTANT: Save this key! You will need it to access the dashboard."
fi

# Set default values
export PORT=${PORT:-8000}
export AGENT_CANVAS_MODE=${AGENT_CANVAS_MODE:-full}
export PUBLIC_URL=${PUBLIC_URL:-http://localhost:$PORT}

echo "Configuration:"
echo "  - Mode: $AGENT_CANVAS_MODE"
echo "  - Port: $PORT"
echo "  - Public URL: $PUBLIC_URL"

# Start Agent Canvas
echo "Starting Agent Canvas..."
exec agent-canvas --public
