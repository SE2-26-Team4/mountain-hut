# frontend

FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# backend 

FROM node:20-alpine AS runner
WORKDIR /app

COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

COPY server/ ./

COPY --from=client-builder /app/client/dist /app/client/dist

RUN mkdir -p /app/server/data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/server/data/mountain_hut.db

EXPOSE 8080

CMD ["node", "index.js"]