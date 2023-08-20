# syntax=docker/dockerfile:1.6
FROM --platform=$BUILDPLATFORM node:20-alpine as builder

WORKDIR /app

COPY --link package*.json .

RUN npm ci

COPY --link tsconfig.json ./
COPY --link src ./src

RUN npm run build


FROM --platform=$TARGETPLATFORM node:20-alpine

ENV NODE_ENV production

WORKDIR /app

COPY --link package*.json .

RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --link --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
