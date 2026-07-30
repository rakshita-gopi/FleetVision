from dataclasses import dataclass, field

from .routes import interpolate, route_for_index


@dataclass
class SimulatedVehicle:
    vehicle_id: str
    index: int
    fuel_level: float = 75.0
    odometer: float = 48000.0
    engine_temperature: float = 85.0
    battery_voltage: float = 12.6
    rpm: int = 1800
    speed: float = 40.0
    heading: float = 90.0
    step: int = 0
    progress: float = 0.0
    route: list = field(default_factory=list)

    def __post_init__(self):
        if not self.route:
            self.route = route_for_index(self.index)

    def tick(self) -> dict:
        n = len(self.route)
        i = self.step % n
        j = (self.step + 1) % n
        self.progress += 0.2
        if self.progress >= 1.0:
            self.progress = 0.0
            self.step = (self.step + 1) % n
            i = self.step % n
            j = (self.step + 1) % n

        lat, lng = interpolate(self.route[i], self.route[j], self.progress)
        self.speed = 35 + (self.index * 3) + (self.step % 5) * 4
        self.heading = (self.heading + 8) % 360
        self.rpm = int(1600 + self.speed * 12)
        self.fuel_level = max(5.0, self.fuel_level - 0.05)
        self.engine_temperature = min(98.0, 82 + self.speed * 0.15)
        self.battery_voltage = 12.4 + (0.3 if self.speed > 20 else 0)
        self.odometer += self.speed * (5 / 3600)

        return {
            "vehicle_id": self.vehicle_id,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "speed": round(self.speed, 1),
            "heading": round(self.heading, 1),
            "rpm": self.rpm,
            "fuel_level": round(self.fuel_level, 1),
            "engine_temperature": round(self.engine_temperature, 1),
            "battery_voltage": round(self.battery_voltage, 1),
            "odometer": round(self.odometer, 1),
            "gps_accuracy": 8.0,
            "source": "SIMULATOR",
        }
