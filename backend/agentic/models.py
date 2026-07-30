import uuid
from django.conf import settings
from django.db import models


class AgentSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="agent_sessions")
    title = models.CharField(max_length=255, blank=True, default="Agentic session")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agent_sessions"
        ordering = ["-updated_at"]


class AgentMessage(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(AgentSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    tool_trace = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agent_messages"
        ordering = ["created_at"]


class ActionProposal(models.Model):
    class ActionType(models.TextChoices):
        RETAIN = "retain", "Retain"
        RETURN = "return", "Return"
        REALLOCATE = "reallocate", "Reallocate"
        INSPECT = "inspect", "Inspect"
        MAINTAIN = "maintain", "Maintain"
        EXTEND = "extend", "Extend"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        EXECUTED = "executed", "Executed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(AgentSession, on_delete=models.CASCADE, related_name="proposals", null=True, blank=True)
    action_type = models.CharField(max_length=32, choices=ActionType.choices)
    equipment = models.ForeignKey(
        "equipment.Equipment", on_delete=models.SET_NULL, null=True, blank=True, related_name="action_proposals"
    )
    rental = models.ForeignKey(
        "rentals.Rental", on_delete=models.SET_NULL, null=True, blank=True, related_name="action_proposals"
    )
    rationale = models.TextField()
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_proposals"
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_proposals"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "action_proposals"
        ordering = ["-created_at"]
