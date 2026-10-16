#!/bin/sh
set -e

echo "Applying Prisma schema push to database..."
npx prisma db push --schema ./prisma/schema.prisma --url "${DATABASE_URL:-file:/app/data/prod.db}"

echo "Starting Next.js..."
exec node server.js
