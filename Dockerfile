# OpenHands Self-Hosted Dockerfile
# For deploying on Render or any Docker-compatible platform

FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    gnupg \
    nginx \
    certbot \
    python3-certbot-nginx \
    tmux \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js tools globally
RUN npm install -g @openhands/agent-canvas

# Create application directory
WORKDIR /app

# Copy startup scripts
COPY scripts/startup.sh /app/startup.sh
COPY scripts/nginx.conf /etc/nginx/sites-available/canvas

# Make scripts executable
RUN chmod +x /app/startup.sh

# Expose ports
EXPOSE 8000 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run startup script
CMD ["/app/startup.sh"]
