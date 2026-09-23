FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/products/package.json services/products/package.json
COPY services/auth/package.json services/auth/package.json
COPY services/orders/package.json services/orders/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY services/products services/products
RUN npm run build:products

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/products/package.json services/products/package.json
COPY services/auth/package.json services/auth/package.json
COPY services/orders/package.json services/orders/package.json
RUN npm ci --omit=dev

COPY --from=build /app/services/products/dist services/products/dist

USER node
EXPOSE 3000
CMD ["node", "services/products/dist/main.js"]
