import uuid
from django.db import models


class Site(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site_id = models.CharField(max_length=32, unique=True)
    site_name = models.CharField(max_length=255)
    site_type = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=32, default="ACTIVE")

    class Meta:
        db_table = "rental_sites"
        ordering = ["site_id"]

    def __str__(self):
        return f"{self.site_id} — {self.site_name}"
