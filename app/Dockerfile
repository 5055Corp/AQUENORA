# AQUENORA web: the seller app (index.html) and store pages (store.html), served by server.mjs.
# Build context: this app/ folder. Railway passes the service's variables in as build args.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Baked into the JavaScript at build time. None are secrets: the publishable key is public by
# design (it only allows reading published store data).
ARG VITE_API_URL
ARG VITE_MEDUSA_PUBLISHABLE_KEY
ARG VITE_STORE_DOMAIN
# Refuse to build the live site without a backend: it would silently become the demo.
RUN test -n "$VITE_API_URL" || (echo "Set VITE_API_URL to the backend's public address (e.g. https://api.aquenora.com)" && exit 1)
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /srv
COPY --from=build /app/dist ./dist
COPY server.mjs ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
