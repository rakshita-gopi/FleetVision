from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.permissions import IsFleetManagerOrAdmin
from common.response import api_response
from .models import ActionProposal, AgentSession
from .runtime import catalog, run_agui_turn
from .serializers import ActionProposalSerializer, AgentSessionSerializer
from .services import execute_proposal, run_agent_chat


class AgenticCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return api_response(True, "Agent & worker catalog", catalog())


class AgenticRunView(APIView):
    """AG-UI inspired turn: returns event stream payload + shared state."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = (request.data.get("message") or request.data.get("question") or "").strip()
        if not message:
            return api_response(False, "message is required", status_code=400)
        result = run_agui_turn(
            user=request.user,
            message=message,
            session_id=request.data.get("session_id"),
            agent_id=request.data.get("agent_id"),
        )
        return api_response(True, "Agent run", result)


class AgenticChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = (request.data.get("message") or request.data.get("question") or "").strip()
        if not message:
            return api_response(False, "message is required", status_code=400)
        # Prefer AG-UI run so UI gets events + HITL; chat stays as alias
        if request.data.get("agui", True):
            result = run_agui_turn(
                user=request.user,
                message=message,
                session_id=request.data.get("session_id"),
                agent_id=request.data.get("agent_id"),
            )
            return api_response(True, "Agent reply", result)
        session_id = request.data.get("session_id")
        result = run_agent_chat(user=request.user, message=message, session_id=session_id)
        return api_response(True, "Agent reply", result)


class AgentSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = AgentSession.objects.filter(id=session_id, user=request.user).first()
        if not session:
            return api_response(False, "Session not found", status_code=404)
        return api_response(True, "Session", AgentSessionSerializer(session).data)


class ActionProposalListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ActionProposal.objects.select_related("equipment", "rental").all()
        st = request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return api_response(True, "Proposals", ActionProposalSerializer(qs[:50], many=True).data)


class ActionProposalApproveView(APIView):
    permission_classes = [IsFleetManagerOrAdmin]

    def post(self, request, proposal_id):
        proposal = ActionProposal.objects.filter(id=proposal_id).first()
        if not proposal:
            return api_response(False, "Proposal not found", status_code=404)
        if proposal.status != ActionProposal.Status.PENDING:
            return api_response(False, f"Proposal is {proposal.status}", status_code=400)
        msg = execute_proposal(proposal)
        proposal.status = ActionProposal.Status.EXECUTED
        proposal.reviewed_by = request.user
        proposal.reviewed_at = timezone.now()
        proposal.save()
        data = ActionProposalSerializer(proposal).data
        data["execution_result"] = msg
        return api_response(True, "Proposal approved and executed", data)


class ActionProposalRejectView(APIView):
    permission_classes = [IsFleetManagerOrAdmin]

    def post(self, request, proposal_id):
        proposal = ActionProposal.objects.filter(id=proposal_id).first()
        if not proposal:
            return api_response(False, "Proposal not found", status_code=404)
        if proposal.status != ActionProposal.Status.PENDING:
            return api_response(False, f"Proposal is {proposal.status}", status_code=400)
        proposal.status = ActionProposal.Status.REJECTED
        proposal.reviewed_by = request.user
        proposal.reviewed_at = timezone.now()
        proposal.save()
        return api_response(True, "Proposal rejected", ActionProposalSerializer(proposal).data)
