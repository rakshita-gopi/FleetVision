import os
import pandas as pd
from sqlalchemy import create_engine

DB_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/smart_rental")
engine = create_engine(DB_URL)

files = ["equipment_models","equipment","sites","operators","rentals","site_demand","maintenance","telemetry_24h_5min"]
for name in files:
    df = pd.read_csv(f"{name}.csv")
    table = "telemetry" if name == "telemetry_24h_5min" else name
    df.to_sql(table, engine, if_exists="replace", index=False, chunksize=5000, method="multi")
    print(f"Loaded {len(df):,} rows -> {table}")
