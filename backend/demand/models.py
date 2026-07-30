import uuid
from django.db import models


class SiteDemand(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField(db_index=True)
    site = models.ForeignKey("sites.Site", on_delete=models.CASCADE, related_name="demand_rows")
    equipment_category = models.CharField(max_length=100, db_index=True)
    requested_units = models.IntegerField(default=0)
    allocated_units = models.IntegerField(default=0)
    utilisation_pct = models.FloatField(default=0)

    class Meta:
        db_table = "site_demand"
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["site", "equipment_category", "-date"], name="idx_demand_site_cat_date"),
        ]

    def __str__(self):
        return f"{self.date} {self.site_id} {self.equipment_category}"
