"""Resolve model rows by UUID primary key or business code without ValidationError."""

from __future__ import annotations

from typing import Any, TypeVar
from uuid import UUID

from django.core.exceptions import ValidationError
from django.db import models

T = TypeVar("T", bound=models.Model)


def is_uuid(value: Any) -> bool:
    if value is None:
        return False
    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def get_by_uuid_or_code(model: type[T], value: Any, code_field: str) -> T | None:
    """Look up by UUID `id` when value is a UUID, otherwise by `code_field`."""
    if value is None or value == "":
        return None
    qs = model.objects
    if is_uuid(value):
        try:
            obj = qs.filter(id=value).first()
        except (ValidationError, ValueError, TypeError):
            obj = None
        if obj is not None:
            return obj
    try:
        return qs.filter(**{code_field: value}).first()
    except (ValidationError, ValueError, TypeError):
        return None
