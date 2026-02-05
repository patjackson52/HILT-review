# ---- Build stage ----
FROM node:20-slim AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy workspace package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Install dependencies
RUN npm ci

# Copy source files
COPY packages/shared/ packages/shared/
COPY backend/ backend/
COPY frontend/ frontend/

# Build all workspaces (shared → backend + frontend)
RUN npx turbo run build

# ---- Production stage ----
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace root files
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/

# Copy backend package.json
COPY backend/package.json backend/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=backend --workspace=packages/shared

# Copy built artifacts
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/drizzle backend/drizzle
COPY --from=build /app/frontend/dist frontend/dist

# The backend serves the API; a reverse proxy (nginx, Caddy, etc.)
# or the platform's static hosting serves frontend/dist.

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
