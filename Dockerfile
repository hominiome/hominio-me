# Use Bun image
FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
# Skip postinstall scripts to avoid compiling zero-sqlite3 (not needed in production)
# The Zero client works fine without the SQLite bindings when connecting to remote server
RUN cd /temp/dev && bun install --ignore-scripts

# Build the app
FROM base AS build

# Accept build args (secrets from GitHub Actions)
ARG SECRET_NEON_PG_AUTH
ARG SECRET_GOOGLE_CLIENT_ID
ARG SECRET_GOOGLE_CLIENT_SECRET
ARG SECRET_AUTH_SECRET

# Make them available as environment variables during build
ENV SECRET_NEON_PG_AUTH=$SECRET_NEON_PG_AUTH
ENV SECRET_GOOGLE_CLIENT_ID=$SECRET_GOOGLE_CLIENT_ID
ENV SECRET_GOOGLE_CLIENT_SECRET=$SECRET_GOOGLE_CLIENT_SECRET
ENV SECRET_AUTH_SECRET=$SECRET_AUTH_SECRET

COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bun run build

# Production image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=build /app/build build
COPY --from=build /app/package.json .

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Start the app
CMD ["bun", "run", "start"]

