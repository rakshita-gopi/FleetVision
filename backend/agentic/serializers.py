from rest_framework import serializers
from .models import ActionProposal, AgentMessage, AgentSession


class AgentMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMessage
        fields = ["id", "role", "content", "tool_trace", "created_at"]


class ActionProposalSerializer(serializers.ModelSerializer):
    asset_id = serializers.SerializerMethodField()
    rental_id = serializers.SerializerMethodField()

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

    def get_asset_id(self, obj):
        return obj.equipment.asset_id if obj.equipment_id else None

    def get_rental_id(self, obj):
        return obj.rental.rental_id if obj.rental_id else None


class AgentSessionSerializer(serializers.ModelSerializer):
    messages = AgentMessageSerializer(many=True, read_only=True)
    proposals = ActionProposalSerializer(many=True, read_only=True)

    class Meta:
        model = AgentSession
        fields = ["id", "title", "created_at", "updated_at", "messages", "proposals"]
