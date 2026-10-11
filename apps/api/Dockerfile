# Operator API. Build from the repository root: docker build -f apps/api/Dockerfile .
FROM oven/bun:1.3-slim
WORKDIR /repo
COPY . .
# Only this service and the library it imports: a full workspace install would also pull in the web apps.
RUN bun install --frozen-lockfile --filter '@tsamara/api' --filter '@tsamara/sukuk'
ENV API_PORT=8788
EXPOSE 8788
CMD ["bun", "apps/api/index.ts"]
