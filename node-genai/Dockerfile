# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Final stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN adduser -D -g '' nomadicmehul

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY app.js ./
COPY package.json ./
COPY static/ ./static/
COPY templates/ ./templates/

# Set ownership
RUN chown -R nomadicmehul:nomadicmehul /app

# Switch to non-root user
USER nomadicmehul

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

# Run the application
CMD ["node", "app.js"]
