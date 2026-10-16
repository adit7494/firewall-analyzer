# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Ensure the seed directory is accessible since the app loads JSON files from it at runtime!
# In standalone mode, files not strictly imported might not be traced, but since we use `fs.readFileSync` with `process.cwd()`, we should ensure the seed folder exists in the final image.
COPY --from=builder --chown=nextjs:nodejs /app/supabase/seed ./supabase/seed
# We also load `cis_fortigate_7.4.x_seed.json` from the root, let's copy it just in case!
COPY --from=builder --chown=nextjs:nodejs /app/cis_fortigate_7.4.x_seed.json ./cis_fortigate_7.4.x_seed.json

# Copy prisma schema for DB push
COPY --from=builder /app/prisma ./prisma

# Copy native libsql binaries (not traced by Next.js standalone output)
COPY --from=deps /app/node_modules/libsql ./node_modules/libsql
COPY --from=deps /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=deps /app/node_modules/@prisma/adapter-libsql ./node_modules/@prisma/adapter-libsql
COPY --from=deps /app/node_modules/@prisma/driver-adapter-utils ./node_modules/@prisma/driver-adapter-utils

# Copy the entrypoint script
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Switch to root to install prisma globally for db push
USER root
RUN npm install -g prisma

# Revert to nextjs user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/entrypoint.sh"]
