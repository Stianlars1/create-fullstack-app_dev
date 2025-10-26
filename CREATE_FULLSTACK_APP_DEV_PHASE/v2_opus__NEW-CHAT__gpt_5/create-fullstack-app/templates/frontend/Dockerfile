# CHAT_GPT_5_SOLUTION
# path: ..root/template/frontend/Dockerfile
# deps
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --fund=false; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm i --no-audit --fund=false; fi

# build
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# copy static into standalone for server.js to serve
RUN mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/ && \
    if [ -d public ]; then cp -r public .next/standalone/; fi

# run
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN adduser -D -H nextjs && apk add --no-cache libc6-compat
COPY --from=builder /app/.next/standalone ./
USER nextjs
EXPOSE 3000
CMD ["node","server.js"]
