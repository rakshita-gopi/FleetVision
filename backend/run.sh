#!/usr/bin/env bash
# FleetVision backend — use system Python (Homebrew python3 often has no Django).
set -e
cd "$(dirname "$0")"
PY="${FLEETVISION_PYTHON:-/usr/bin/python3}"
echo "Using: $PY"
exec "$PY" manage.py runserver 8000
