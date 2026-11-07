FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tar && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/paracolor/.output
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output /opt/paracolor/.output
COPY scripts/docker-entrypoint.sh /usr/local/bin/paracolor-entrypoint
RUN chmod +x /usr/local/bin/paracolor-entrypoint
EXPOSE 3000
CMD ["/usr/local/bin/paracolor-entrypoint"]
