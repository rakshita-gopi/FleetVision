from rest_framework import serializers
from .models import ActionProposal, AgentMessage, AgentSession


class AgentMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMessage
        fields = ["id", "role", "content", "tool_trace", "created_at"]


class ActionProposalSerializer(serializers.ModelSerializer):
    asset_id = serializers.CharField(source="equipment.asset_id", read_only=True, default=None)
    rental_id = serializers.CharField(source="rental.rental_id", read_only=True, default=None)

    class Meta:
        model = ActionProposal
        fields = [
            "id",
            "session",
            "action_type",
            "equipment",
            "asset_id",
            "rental",
            "rental_id",
            "rationale",
            "payload",
            "status",
            "created_at",
            "reviewed_at",
        ]


class AgentSessionSerializer(serializers.ModelSerializer):
    messages = AgentMessageSerializer(many=True, read_only=True)
    proposals = ActionProposalSerializer(many=True, read_only=True)

    class Meta:
        model = AgentSession
        fields = ["id", "title", "created_at", "updated_at", "messages", "proposals"]
