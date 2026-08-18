FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY backend/package*.json backend/
COPY ui/package*.json ui/
COPY tauri/package*.json tauri/
COPY packages/shared/package*.json packages/shared/
RUN npm ci

COPY . .
RUN mkdir -p /app/ui/node_modules
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build --workspace=@local-res/shared
RUN npm run build:web --workspace=ui

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/ui/package.json ./ui/
COPY --from=builder /app/ui/node_modules ./ui/node_modules
COPY --from=builder /app/ui/.next ./ui/.next
COPY --from=builder /app/ui/next.config.js ./ui/next.config.js
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=ui"]
