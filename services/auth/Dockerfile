FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/products/package.json services/products/package.json
COPY services/auth/package.json services/auth/package.json
COPY services/orders/package.json services/orders/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY services/auth services/auth
COPY scripts/service-build-info.mjs scripts/service-build-info.mjs
ARG BUILD_VERSION
ARG BUILD_COMMIT
ENV BUILD_VERSION=$BUILD_VERSION BUILD_COMMIT=$BUILD_COMMIT
RUN npm run build:auth

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ARG BUILD_VERSION
ARG BUILD_COMMIT
LABEL org.opencontainers.image.version=$BUILD_VERSION org.opencontainers.image.revision=$BUILD_COMMIT

COPY package.json package-lock.json ./
COPY services/products/package.json services/products/package.json
COPY services/auth/package.json services/auth/package.json
COPY services/orders/package.json services/orders/package.json
RUN npm ci --omit=dev

COPY --from=build /app/services/auth/dist services/auth/dist

USER node
EXPOSE 3000
CMD ["node", "services/auth/dist/main.js"]
