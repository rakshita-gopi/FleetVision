# Smart Rental Tracking Synthetic Dataset

Purpose: hackathon-ready synthetic dataset grounded in Caterpillar's public equipment/rental taxonomy.
All asset IDs, serials, sites, operators, rental transactions, prices, telemetry, maintenance events and demand records are synthetic.
Do not present synthetic fields as Caterpillar operational/customer data.

Files:
- equipment_models.csv: CAT-grounded model/category reference layer
- equipment.csv: 120 synthetic rental assets
- sites.csv: 15 fictional sites
- operators.csv: 60 fictional operators
- rentals.csv: 1,200 synthetic rental transactions
- site_demand.csv: historical demand/utilisation records
- maintenance.csv: 500 synthetic maintenance events
- telemetry_24h_5min.csv: 24 hours of 5-minute telemetry for all assets, including injected anomalies
- schema.json: inferred CSV column types
- ingest_postgres.py: minimal ingestion example

Grounding notes:
CAT Rentals publicly lists categories including earthmoving, compaction, material handling, power, pumps, HVAC and more.
The CAT product catalogue lists major machine families such as excavators, dozers, wheel loaders, backhoe loaders,
skid steer/compact track loaders, articulated trucks, motor graders and soil compactors.
The 262D3 reference row uses publicly published CAT specs: gross power 55.4 kW and operating weight 3,763 kg.
Other numeric operational values are synthetic unless explicitly marked as grounded.

Recommended architecture:
CSV seed data -> PostgreSQL
telemetry CSV / live simulator -> Kafka -> TimescaleDB
PostgreSQL + TimescaleDB -> backend -> analytics/agents/dashboard
