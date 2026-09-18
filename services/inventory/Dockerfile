FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/inventory/package.json services/inventory/package.json
COPY services/products/package.json services/products/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY services/inventory services/inventory
RUN npm run build:inventory

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=stockion

COPY package.json package-lock.json ./
COPY services/inventory/package.json services/inventory/package.json
COPY services/products/package.json services/products/package.json
RUN npm ci --omit=dev

COPY --from=build /app/services/inventory/dist services/inventory/dist

USER node
EXPOSE 3000
CMD ["node", "services/inventory/dist/main.js"]
