#!/bin/bash
set -e

echo "Starting PostgreSQL..."
docker-compose up -d postgres

echo "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U hilt -d hilt_review; do
  sleep 1
done

echo "Running migrations..."
npm run db:migrate --workspace=backend || echo "No migrations yet"

echo "Starting development servers..."
npm run dev
