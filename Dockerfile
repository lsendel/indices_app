# Fallback: primary deployment is Cloudflare Workers (see wrangler.toml)
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Build
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json tsconfig.json drizzle.config.ts ./

# Run
EXPOSE 3001
ENV NODE_ENV=production
CMD ["bun", "run", "src/index.ts"]
