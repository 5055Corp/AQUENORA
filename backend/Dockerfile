# AQENORA backend (Medusa). Build context: this backend/ folder.
# Railway builds this automatically (see railway.json); locally: docker build -t aqenora-backend .

# ---- build: install everything, compile the server and the admin dashboard ----
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --no-audit --no-fund
COPY eslint.config.ts turbo.json ./
COPY apps/backend apps/backend
WORKDIR /repo/apps/backend
RUN npx medusa build
# The build output is a standalone app; install only what it needs to run.
WORKDIR /repo/apps/backend/.medusa/server
RUN npm install --omit=dev --no-audit --no-fund

# ---- run: just the built server ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=9000
WORKDIR /server
COPY --from=build /repo/apps/backend/.medusa/server ./
COPY apps/backend/start.sh ./start.sh
USER node
EXPOSE 9000
CMD ["sh", "./start.sh"]
