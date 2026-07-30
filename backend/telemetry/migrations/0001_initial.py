# Generated manually for Phase 2 telemetry hypertable

from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="VehicleTelemetry",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("time", models.DateTimeField(db_index=True)),
                        ("event_id", models.UUIDField(default=uuid.uuid4, editable=False)),
                        ("vehicle_id", models.UUIDField(db_index=True)),
                        ("latitude", models.FloatField(blank=True, null=True)),
                        ("longitude", models.FloatField(blank=True, null=True)),
                        ("gps_accuracy", models.FloatField(blank=True, null=True)),
                        ("speed", models.FloatField(blank=True, null=True)),
                        ("heading", models.FloatField(blank=True, null=True)),
                        ("rpm", models.IntegerField(blank=True, null=True)),
                        ("fuel_level", models.FloatField(blank=True, null=True)),
                        ("engine_temperature", models.FloatField(blank=True, null=True)),
                        ("battery_voltage", models.FloatField(blank=True, null=True)),
                        ("odometer", models.FloatField(blank=True, null=True)),
                        (
                            "source",
                            models.CharField(
                                choices=[
                                    ("SIMULATOR", "Simulator"),
                                    ("MOBILE", "Mobile"),
                                    ("GPS_DEVICE", "GPS Device"),
                                    ("IOT_GATEWAY", "IoT Gateway"),
                                ],
                                default="SIMULATOR",
                                max_length=30,
                            ),
                        ),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        "db_table": "vehicle_telemetry",
                        "ordering": ["-time"],
                    },
                ),
                migrations.AddIndex(
                    model_name="vehicletelemetry",
                    index=models.Index(fields=["vehicle_id", "-time"], name="idx_vt_vehicle_time"),
                ),
                migrations.AddConstraint(
                    model_name="vehicletelemetry",
                    constraint=models.UniqueConstraint(
                        fields=("event_id", "time"),
                        name="vehicle_telemetry_event_id_time_key",
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    CREATE TABLE IF NOT EXISTS vehicle_telemetry (
                        id BIGSERIAL NOT NULL,
                        time TIMESTAMPTZ NOT NULL,
                        event_id UUID NOT NULL,
                        vehicle_id UUID NOT NULL,
                        latitude DOUBLE PRECISION NULL,
                        longitude DOUBLE PRECISION NULL,
                        gps_accuracy DOUBLE PRECISION NULL,
                        speed DOUBLE PRECISION NULL,
                        heading DOUBLE PRECISION NULL,
                        rpm INTEGER NULL,
                        fuel_level DOUBLE PRECISION NULL,
                        engine_temperature DOUBLE PRECISION NULL,
                        battery_voltage DOUBLE PRECISION NULL,
                        odometer DOUBLE PRECISION NULL,
                        source VARCHAR(30) NOT NULL DEFAULT 'SIMULATOR',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS vehicle_telemetry_time_idx ON vehicle_telemetry (time);
                    CREATE INDEX IF NOT EXISTS vehicle_telemetry_vehicle_id_idx ON vehicle_telemetry (vehicle_id);
                    CREATE INDEX IF NOT EXISTS idx_vt_vehicle_time ON vehicle_telemetry (vehicle_id, time DESC);
                    SELECT create_hypertable('vehicle_telemetry', 'time', if_not_exists => TRUE, migrate_data => TRUE);
                    DO $$ BEGIN
                      ALTER TABLE vehicle_telemetry
                        ADD CONSTRAINT vehicle_telemetry_event_id_time_key UNIQUE (event_id, time);
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END $$;
                    """,
                    reverse_sql="DROP TABLE IF EXISTS vehicle_telemetry CASCADE;",
                ),
            ],
        ),
    ]
