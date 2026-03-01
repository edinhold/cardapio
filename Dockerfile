# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

# Copy built assets and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/vite.config.ts ./

# Expose the application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
