from django.urls import path
from .views import (
    ActionProposalApproveView,
    ActionProposalListView,
    ActionProposalRejectView,
    AgentSessionDetailView,
    AgenticCatalogView,
    AgenticChatView,
    AgenticRunView,
)

urlpatterns = [
    path("catalog/", AgenticCatalogView.as_view(), name="agentic-catalog"),
    path("run/", AgenticRunView.as_view(), name="agentic-run"),
    path("chat/", AgenticChatView.as_view(), name="agentic-chat"),
    path("sessions/<uuid:session_id>/", AgentSessionDetailView.as_view(), name="agentic-session"),
    path("proposals/", ActionProposalListView.as_view(), name="agentic-proposals"),
    path("proposals/<uuid:proposal_id>/approve/", ActionProposalApproveView.as_view(), name="agentic-approve"),
    path("proposals/<uuid:proposal_id>/reject/", ActionProposalRejectView.as_view(), name="agentic-reject"),
]
