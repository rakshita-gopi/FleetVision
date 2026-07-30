#!/bin/sh
set -e

# Telemetry consumer skips web bootstrap when ROLE=consumer
if [ "${ROLE:-web}" = "consumer" ]; then
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
  echo "Starting telemetry consumer..."
  exec python manage.py telemetry_consumer
fi

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

if [ "${SEED_RENTAL:-true}" = "true" ]; then
  echo "Seeding Rental-IQ dataset (safe if already seeded)..."
  python manage.py seed_rental_dataset --telemetry-limit "${TELEMETRY_SEED_LIMIT:-500}" || true
  echo "Seeding site demand for forecasting..."
  python manage.py seed_site_demand || true
fi

echo "Scanning rental due / overdue alerts..."
python manage.py scan_rental_alerts || true

echo "Collecting static files..."
python manage.py collectstatic --noinput || true

echo "Starting Rental-IQ API (ASGI/Daphne) on 0.0.0.0:8000..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
