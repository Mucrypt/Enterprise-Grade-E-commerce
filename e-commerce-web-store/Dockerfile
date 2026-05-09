# ================================
# Production Dockerfile for Customer Marketplace (Vite)
# Multi-stage build for optimized production image
# ================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json ./
RUN npm install

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL
ARG VITE_MEDIA_URL
ARG VITE_TAWK_SITE_ID
ARG VITE_TAWK_WIDGET_ID

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV VITE_TELEMETRY_DISABLED=1

# Vite injects these at build time
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MEDIA_URL=$VITE_MEDIA_URL
ENV VITE_TAWK_SITE_ID=$VITE_TAWK_SITE_ID
ENV VITE_TAWK_WIDGET_ID=$VITE_TAWK_WIDGET_ID

RUN npm run build

# Stage 3: Runner (Nginx to serve static files)
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# Copy built assets
COPY --from=builder /app/dist .

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
