"""Coimbatore-area waypoint routes for simulated vehicles."""

# Base route near Coimbatore (from Phase 2 PDF)
BASE_ROUTE = [
    (11.0168, 76.9558),
    (11.0175, 76.9570),
    (11.0184, 76.9582),
    (11.0193, 76.9600),
    (11.0201, 76.9615),
    (11.0210, 76.9630),
    (11.0195, 76.9640),
    (11.0180, 76.9620),
    (11.0168, 76.9558),
]


def route_for_index(index: int) -> list[tuple[float, float]]:
    """Offset each vehicle slightly so markers don't stack."""
    lat_off = index * 0.002
    lng_off = index * 0.0025
    return [(lat + lat_off, lng + lng_off) for lat, lng in BASE_ROUTE]


def interpolate(a: tuple[float, float], b: tuple[float, float], t: float) -> tuple[float, float]:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
