# Multi-stage build for the Astro node-standalone server.
# Node 22 LTS satisfies astro's >=22.12.0 floor; pinning the image avoids the
# nixpacks nixpkgs node-version roulette.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
# astro itself is a devDependency the built server still imports, so carry the
# full module tree rather than pruning dev deps.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
