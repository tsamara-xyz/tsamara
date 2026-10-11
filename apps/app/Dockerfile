# Web app. Build from the repository root: docker build -f apps/app/Dockerfile .
# Next.js runs on Node; Bun is only the package manager here.
FROM node:22-slim
RUN npm install --global bun@1.3
WORKDIR /repo
COPY . .
# Only this app and the library it imports, not the whole workspace.
RUN bun install --frozen-lockfile --filter '@tsamara/app' --filter '@tsamara/sukuk'
# Public URLs are compiled into the browser bundle.
ARG NEXT_PUBLIC_API
ARG NEXT_PUBLIC_INDEXER
ARG NEXT_PUBLIC_RPC
ENV NEXT_PUBLIC_API=$NEXT_PUBLIC_API NEXT_PUBLIC_INDEXER=$NEXT_PUBLIC_INDEXER NEXT_PUBLIC_RPC=$NEXT_PUBLIC_RPC
RUN bun run --cwd apps/app build
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/app", "start"]
