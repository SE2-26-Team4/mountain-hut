# Frontend

FROM node:20-alpine AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Backend

FROM node:20-alpine AS runner

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/mountain-hut.sqlite

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./

COPY --from=client-builder /app/client/dist /app/client/dist

# Persistent SQLite database storage

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["node", "index.js"]
