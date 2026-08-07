FROM node:22-slim AS build
WORKDIR /app
ARG VITE_METAON_CLIENT_APP_VERSION=3.2.1
ENV VITE_METAON_CLIENT_APP_VERSION=$VITE_METAON_CLIENT_APP_VERSION

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "server/index.mjs"]
