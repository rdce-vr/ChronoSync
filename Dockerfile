# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy all source files
COPY . .

# Run compilation/bundle commands (creates production dist/ folder and dist/server.cjs)
RUN npm run build

# Remove development dependencies to keep final image small
RUN npm prune --production


# Stage 2: Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7332

# Copy necessary production artifacts from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose port 3000
EXPOSE 3000

# Start the optimized Node server
CMD ["npm", "start"]
