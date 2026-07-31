from django.urls import path
from .views import RewardsLeaderboardView, RewardsMeView, RewardsRedeemView, RewardsSyncView

urlpatterns = [
    path("me/", RewardsMeView.as_view(), name="rewards-me"),
    path("leaderboard/", RewardsLeaderboardView.as_view(), name="rewards-leaderboard"),
    path("redeem/", RewardsRedeemView.as_view(), name="rewards-redeem"),
    path("sync/", RewardsSyncView.as_view(), name="rewards-sync"),
]
