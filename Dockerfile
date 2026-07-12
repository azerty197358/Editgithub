# OpenHands Self-Hosted Dockerfile
# Optimized for Render Free Tier

FROM node:22-slim

# Install minimal dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager required by agent-canvas)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install Node.js tools globally
RUN npm install -g @openhands/agent-canvas

# Create application directory
WORKDIR /app

# Copy startup scripts
COPY scripts/startup.sh /app/startup.sh

# Make scripts executable
RUN chmod +x /app/startup.sh

# Set memory limit hint for Python
ENV PYTHONMALLOC=malloc
ENV UV_LINK_MODE=copy

# Expose ports
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run startup script
CMD ["/app/startup.sh"]
