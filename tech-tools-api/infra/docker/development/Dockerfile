# Development Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install development dependencies
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 9000

# Run in development mode with hot reload
CMD ["npm", "run", "dev"]
