#!/usr/bin/env python3
"""
FleetVision Phase 2 GPS simulator.

Usage (from repo root, with API running):
  python -m simulator
  SIMULATOR_VEHICLE_COUNT=5 python -m simulator
"""

from __future__ import annotations

import sys
import time

import requests

from .config import API_URL, INTERVAL_SECONDS, PASSWORD, USERNAME, VEHICLE_COUNT, VEHICLE_IDS
from .vehicles import SimulatedVehicle


def login() -> str:
    res = requests.post(
        f"{API_URL.rstrip('/')}/auth/login",
        json={"email": USERNAME, "password": PASSWORD},
        timeout=15,
    )
    res.raise_for_status()
    body = res.json()
    token = (body.get("data") or {}).get("access_token")
    if not token:
        raise RuntimeError(f"Login failed: {body}")
    return token


def resolve_vehicle_ids(token: str) -> list[str]:
    if VEHICLE_IDS:
        return VEHICLE_IDS[:VEHICLE_COUNT]
    res = requests.get(
        f"{API_URL.rstrip('/')}/vehicles/",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    res.raise_for_status()
    data = res.json().get("data") or []
    ids = [str(v["id"]) for v in data]
    if not ids:
        raise RuntimeError("No vehicles found — seed demo data first")
    return ids[:VEHICLE_COUNT]


def post_telemetry(token: str, payload: dict) -> None:
    res = requests.post(
        f"{API_URL.rstrip('/')}/telemetry/",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
        timeout=15,
    )
    if res.status_code >= 400:
        print(f"Ingest error {res.status_code}: {res.text}", file=sys.stderr)


def run() -> None:
    print(f"Simulator → {API_URL} every {INTERVAL_SECONDS}s ({VEHICLE_COUNT} vehicle(s))")
    token = login()
    ids = resolve_vehicle_ids(token)
    fleet = [SimulatedVehicle(vehicle_id=vid, index=i) for i, vid in enumerate(ids)]
    print("Tracking:", ", ".join(ids))
    while True:
        for sim in fleet:
            payload = sim.tick()
            post_telemetry(token, payload)
            print(
                f"  {payload['vehicle_id'][:8]}… "
                f"lat={payload['latitude']} lng={payload['longitude']} "
                f"spd={payload['speed']} fuel={payload['fuel_level']}"
            )
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    run()
