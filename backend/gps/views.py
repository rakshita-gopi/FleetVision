import random
from decimal import Decimal
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from common.permissions import IsDriverOrAbove
from drivers.models import Driver
from trips.models import Trip, TripStatus
from vehicles.models import Vehicle
from .models import VehicleLocation, GPSHistory
from .serializers import VehicleLocationSerializer, GPSHistorySerializer


class UpdateLocationView(APIView):
    permission_classes = [IsDriverOrAbove]

    def post(self, request):
        vehicle_id = request.data.get("vehicle_id")
        driver_id = request.data.get("driver_id")
        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")
        speed = request.data.get("speed", 0)
        heading = request.data.get("heading", 0)

        if not all([vehicle_id, latitude, longitude]):
            return api_response(False, "vehicle_id, latitude, and longitude are required", status_code=400)

        vehicle = Vehicle.objects.filter(id=vehicle_id).first()
        if not vehicle:
            return api_response(False, "Vehicle not found", status_code=404)

        driver = Driver.objects.filter(id=driver_id).first() if driver_id else None
        location, _ = VehicleLocation.objects.update_or_create(
            vehicle=vehicle,
            defaults={
                "driver": driver,
                "latitude": latitude,
                "longitude": longitude,
                "speed": speed,
                "heading": heading,
            },
        )

        active_trip = Trip.objects.filter(vehicle=vehicle, trip_status=TripStatus.IN_PROGRESS).first()
        if active_trip:
            GPSHistory.objects.create(
                trip=active_trip,
                latitude=latitude,
                longitude=longitude,
                speed=speed,
            )

        return api_response(True, "Location Updated Successfully", VehicleLocationSerializer(location).data)


class LiveLocationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, vehicle_id=None):
        if vehicle_id:
            location = VehicleLocation.objects.filter(vehicle_id=vehicle_id).select_related(
                "vehicle", "driver__user"
            ).first()
            if not location:
                return api_response(False, "Location not found", status_code=404)
            return api_response(True, "Location retrieved", VehicleLocationSerializer(location).data)

        locations = VehicleLocation.objects.select_related("vehicle", "driver__user").all()
        return api_response(True, "Live locations retrieved", VehicleLocationSerializer(locations, many=True).data)


class GPSHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, trip_id):
        history = GPSHistory.objects.filter(trip_id=trip_id).order_by("recorded_at")
        return api_response(True, "GPS history retrieved", GPSHistorySerializer(history, many=True).data)


class SimulateGPSView(APIView):
    """Simulate vehicle movement for demo purposes."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        vehicles = Vehicle.objects.filter(status__in=["Available", "On Trip"])[:5]
        base_lat, base_lng = 12.9716, 77.5946  # Bangalore
        updated = []
        for i, vehicle in enumerate(vehicles):
            lat = base_lat + random.uniform(-0.05, 0.05) + i * 0.01
            lng = base_lng + random.uniform(-0.05, 0.05) + i * 0.01
            driver = vehicle.assigned_drivers.first()
            location, _ = VehicleLocation.objects.update_or_create(
                vehicle=vehicle,
                defaults={
                    "driver": driver,
                    "latitude": Decimal(str(round(lat, 7))),
                    "longitude": Decimal(str(round(lng, 7))),
                    "speed": Decimal(str(random.randint(20, 80))),
                    "heading": Decimal(str(random.randint(0, 360))),
                },
            )
            updated.append(VehicleLocationSerializer(location).data)
        return api_response(True, f"Simulated GPS for {len(updated)} vehicles", updated)
