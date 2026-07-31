from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from authentication.models import UserRole
from common.permissions import IsFleetManagerOrAdmin
from common.response import api_response
from .models import CustomerRewardAccount
from .services import (
    account_summary,
    award_for_completed_rentals,
    ensure_customer_profiles,
    leaderboard,
    redeem_points,
)


class RewardsMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_customer_profiles()
        user = request.user
        account = None
        if user.role == UserRole.CUSTOMER:
            account = CustomerRewardAccount.objects.filter(user=user).first()
            if not account:
                cid = f"CUST-{user.email.split('@')[0].upper()}"
                account, _ = CustomerRewardAccount.objects.get_or_create(
                    customer_id=cid,
                    defaults={"user": user, "customer_name": user.full_name},
                )
        else:
            cid = request.query_params.get("customer_id")
            if cid:
                account = CustomerRewardAccount.objects.filter(customer_id=cid).first()
        if not account:
            return api_response(False, "No reward account", status_code=404)
        return api_response(True, "Reward account", account_summary(account))


class RewardsLeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_customer_profiles()
        award_for_completed_rentals(limit=200)
        return api_response(True, "Rewards leaderboard", {"rows": leaderboard()})


class RewardsRedeemView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        points = int(request.data.get("points") or 0)
        reason = request.data.get("reason") or "Redemption"
        if request.user.role == UserRole.CUSTOMER:
            account = CustomerRewardAccount.objects.filter(user=request.user).first()
            if not account:
                return api_response(False, "No reward account", status_code=404)
            customer_id = account.customer_id
        else:
            if request.user.role not in (UserRole.ADMINISTRATOR, UserRole.FLEET_MANAGER):
                return api_response(False, "Forbidden", status_code=403)
            customer_id = request.data.get("customer_id") or ""
        try:
            acc = redeem_points(customer_id=customer_id, points=points, reason=reason)
        except ValueError as exc:
            return api_response(False, str(exc), status_code=400)
        return api_response(True, "Points redeemed", account_summary(acc))


class RewardsSyncView(APIView):
    permission_classes = [IsFleetManagerOrAdmin]

    def post(self, request):
        created = ensure_customer_profiles()
        awarded = award_for_completed_rentals()
        return api_response(True, "Rewards synced", {"profiles": created, "awarded": awarded})
