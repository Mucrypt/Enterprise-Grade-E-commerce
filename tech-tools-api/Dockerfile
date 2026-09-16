# Multi-stage build for production
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
# Using npm install instead of npm ci for workspace compatibility
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

# dumb-init for proper signal handling; ffmpeg is a real runtime dependency
# now, not a dev tool -- Discover feed video uploads get transcoded to
# H.264/AAC MP4 on upload (see processDiscoverVideo in utils/media.ts),
# since arbitrary admin-uploaded video (e.g. iPhone .mov/HEVC) otherwise
# fails to play in most browsers with no visible error.
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

# Create uploads directory with proper ownership
RUN mkdir -p /app/uploads/products/images /app/uploads/products/videos /app/uploads/products/thumbnails \
             /app/uploads/categories/images /app/uploads/categories/videos /app/uploads/categories/thumbnails \
             /app/uploads/temp && \
    chown -R nodejs:nodejs /app/uploads

# Copy package files for production install
COPY --chown=nodejs:nodejs package*.json ./

# Install only production dependencies
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Switch to non-root user
USER nodejs

EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]