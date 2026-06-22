# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install ALL dependencies (devDeps needed for vite + esbuild build steps)
RUN npm ci

# Copy all source files
COPY . .

# Run compilation/bundle commands (creates production dist/ and dist/server.cjs)
RUN npm run build

# Stage 2: Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7332

# Copy built artifacts from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/dist ./dist

# Install only production runtime dependencies in the clean runner stage.
# This is safer than copying a pruned node_modules from builder.
RUN npm ci --omit=dev

# Expose port 7332
EXPOSE 7332

# Start the optimized Node server
CMD ["npm", "start"]
