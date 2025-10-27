# Use Bun image
FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
RUN cd /temp/dev && bun install

# Build the app
FROM base AS build
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

