FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000 3001

VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV SYSTEM_DB_PATH=/app/data/system.db

CMD ["node", "dist/index.js"]
