from django.contrib import admin
from authentication.models import User
from drivers.models import Driver
from vehicles.models import Vehicle
from trips.models import Trip
from fuel.models import FuelLog
from maintenance.models import MaintenanceRecord
from expenses.models import Expense
from notifications.models import Notification
from gps.models import VehicleLocation

admin.site.register(User)
admin.site.register(Driver)
admin.site.register(Vehicle)
admin.site.register(Trip)
admin.site.register(FuelLog)
admin.site.register(MaintenanceRecord)
admin.site.register(Expense)
admin.site.register(Notification)
admin.site.register(VehicleLocation)
