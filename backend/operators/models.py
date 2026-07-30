import uuid
from django.db import models


class Operator(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operator_id = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=255)
    certification = models.CharField(max_length=100, blank=True)
    experience_years = models.IntegerField(default=0)
    shift = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=32, default="ACTIVE")

    class Meta:
        db_table = "rental_operators"
        ordering = ["operator_id"]

    def __str__(self):
        return f"{self.operator_id} — {self.name}"
