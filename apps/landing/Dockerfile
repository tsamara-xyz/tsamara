# Landing page: a static Astro build served by nginx. Build from the repository root.
FROM node:22-slim AS build
RUN npm install --global bun@1.3
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile --filter '@tsamara/landing' && bun run --cwd apps/landing build

FROM nginx:1.29-alpine
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
EXPOSE 80
