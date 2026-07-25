#!/bin/sh
set -e

echo "Waiting for PostgreSQL at ${DATABASE_HOST:-db}:${DATABASE_PORT:-5432}..."

python <<'PY'
import os, socket, time
host = os.getenv("DATABASE_HOST", "db")
port = int(os.getenv("DATABASE_PORT", "5432"))
for i in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            print("PostgreSQL is ready.")
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("PostgreSQL did not become ready in time")
PY

echo "Running migrations..."
# Retry briefly — Postgres can accept TCP before it is fully ready for auth.
i=0
until python manage.py migrate --noinput; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Migrations failed after retries"
    exit 1
  fi
  echo "Migrate failed (attempt $i); retrying in 2s..."
  sleep 2
done

if [ "${SEED_DEMO:-true}" = "true" ]; then
  echo "Seeding demo data (safe if already seeded)..."
  python manage.py seed_demo || true
fi

echo "Collecting static files..."
python manage.py collectstatic --noinput || true

echo "Starting FleetVision API on 0.0.0.0:8000..."
if [ "${DJANGO_DEBUG:-True}" = "True" ] || [ "${DEBUG:-True}" = "True" ]; then
  exec python manage.py runserver 0.0.0.0:8000
else
  exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
fi
