# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Make port configurable with default value
ENV PORT=${PORT:-3000}
ENV HOSTNAME=0.0.0.0

# Copy only necessary files from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Use dynamic port exposure
EXPOSE $PORT

# Health check with dynamic port
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://0.0.0.0:$PORT/api/health || exit 1

# Start the application
CMD ["node", "server.js"]