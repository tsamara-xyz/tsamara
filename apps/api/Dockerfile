# Operator API. Build from the repository root: docker build -f apps/api/Dockerfile .
FROM oven/bun:1.3-slim
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile
ENV API_PORT=8788
EXPOSE 8788
CMD ["bun", "apps/api/index.ts"]
