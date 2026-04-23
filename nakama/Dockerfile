FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json rollup.config.js ./
COPY src/ ./src/

RUN npx rollup --config

FROM heroiclabs/nakama:3.21.1

COPY --from=builder /app/build/index.js /nakama/data/modules/build/index.js
COPY local.yml /nakama/data/local.yml
