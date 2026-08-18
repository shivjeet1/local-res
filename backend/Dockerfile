FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl
COPY package*.json ./
COPY backend/package*.json backend/
COPY ui/package*.json ui/
COPY tauri/package*.json tauri/
COPY packages/shared/package*.json packages/shared/
RUN npm ci

COPY . .
RUN mkdir -p /app/backend/node_modules
RUN cd backend && npx prisma generate
RUN npm run build --workspace=backend
RUN npm run build --workspace=@local-res/shared

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 4000
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && node dist/app.js"]
