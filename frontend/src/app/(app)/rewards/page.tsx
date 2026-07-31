"use client";

import { useEffect, useState } from "react";
import { Gift, RefreshCw, Trophy } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";
import CountUp from "@/components/react-bits/CountUp";
import api, { ApiResponse } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

interface RewardAccount {
  customer_id: string;
  customer_name: string;
  points_balance: number;
  lifetime_points: number;
  tier: string;
  ledger: { id: string; entry_type: string; points: number; reason: string; rental_id?: string; created_at: string }[];
}

interface LeaderRow {
  customer_id: string;
  customer_name: string;
  points_balance: number;
  lifetime_points: number;
  tier: string;
}

export default function RewardsPage() {
  const { user } = useAuth();
  const [me, setMe] = useState<RewardAccount | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [redeemPts, setRedeemPts] = useState("100");
  const isCustomer = user?.role === "Customer";
  const canSync = user?.role === "Administrator" || user?.role === "Fleet Manager";

  const load = () => {
    api
      .get<ApiResponse<{ rows: LeaderRow[] }>>("/rewards/leaderboard/")
      .then((res) => setBoard(res.data.data?.rows || []))
      .catch(() => toast.error("Leaderboard failed"));
    if (isCustomer || canSync) {
      api
        .get<ApiResponse<RewardAccount>>("/rewards/me/")
        .then((res) => setMe(res.data.data || null))
        .catch(() => setMe(null));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const sync = async () => {
    try {
      const res = await api.post<ApiResponse<{ awarded: number }>>("/rewards/sync/");
      toast.success(`Synced — awarded ${res.data.data?.awarded ?? 0} events`);
      load();
    } catch {
      toast.error("Sync failed (manager/admin)");
    }
  };

  const redeem = async () => {
    try {
      const res = await api.post<ApiResponse<RewardAccount>>("/rewards/redeem/", {
        points: Number(redeemPts),
        reason: "Checkout credit redemption",
      });
      setMe(res.data.data || null);
      toast.success("Points redeemed");
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Redeem failed";
      toast.error(msg);
    }
  };

  return (
    <>
      <TopNav title="Customer Rewards" subtitle="Points for frequent renters · Bronze → Platinum" />
      <div className="p-6 lg:p-8 space-y-6">
        <SpotlightCard className="p-5" spotlightColor="rgba(212, 160, 23, 0.16)">
          <h2 className="text-xl font-bold">
            <GradientText>Loyalty add-on</GradientText>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">
            Completed rentals earn points (≈10/day + rate bonus). Tiers unlock at 500 / 2000 / 5000 lifetime points.
            Customers redeem toward future checkout credits.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {canSync && (
              <Button variant="outline" onClick={sync}>
                <RefreshCw className="h-4 w-4" /> Sync from completed rentals
              </Button>
            )}
          </div>
        </SpotlightCard>

        {me && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard className="p-4" spotlightColor="rgba(212, 160, 23, 0.12)">
              <Gift className="h-5 w-5 text-[var(--muted)]" />
              <p className="text-2xl font-bold mt-2"><CountUp to={me.points_balance} /></p>
              <p className="text-xs text-[var(--muted)]">Balance · {me.tier}</p>
            </SpotlightCard>
            <SpotlightCard className="p-4" spotlightColor="rgba(13, 148, 136, 0.1)">
              <Trophy className="h-5 w-5 text-[var(--muted)]" />
              <p className="text-2xl font-bold mt-2"><CountUp to={me.lifetime_points} /></p>
              <p className="text-xs text-[var(--muted)]">Lifetime points</p>
            </SpotlightCard>
            <SpotlightCard className="p-4 space-y-2" spotlightColor="rgba(120, 113, 108, 0.1)">
              <p className="text-sm font-semibold">Redeem</p>
              <div className="flex gap-2">
                <Input type="number" value={redeemPts} onChange={(e) => setRedeemPts(e.target.value)} />
                <Button onClick={redeem}>Go</Button>
              </div>
            </SpotlightCard>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SpotlightCard className="p-4" spotlightColor="rgba(212, 160, 23, 0.1)">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4" /> Leaderboard</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {board.map((r, i) => (
                <div key={r.customer_id} className="flex items-center justify-between rounded-xl bg-[var(--muted-bg)] px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">#{i + 1} {r.customer_name || r.customer_id}</p>
                    <p className="text-[10px] text-[var(--muted)]">{r.customer_id}</p>
                  </div>
                  <div className="text-right">
                    <Badge status={r.tier === "Platinum" || r.tier === "Gold" ? "ACTIVE" : "AVAILABLE"} />
                    <p className="text-xs font-semibold mt-1">{r.lifetime_points} pts</p>
                  </div>
                </div>
              ))}
              {!board.length && <p className="text-sm text-[var(--muted)] text-center py-8">No accounts yet — sync completed rentals</p>}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4" spotlightColor="rgba(120, 113, 108, 0.1)">
            <h3 className="font-semibold mb-3">Your ledger</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(me?.ledger || []).map((e) => (
                <div key={e.id} className="rounded-xl bg-[var(--muted-bg)] px-3 py-2 text-sm flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{e.reason}</p>
                    <p className="text-[10px] text-[var(--muted)]">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                  <span className={e.points >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                    {e.points >= 0 ? "+" : ""}{e.points}
                  </span>
                </div>
              ))}
              {!me?.ledger?.length && (
                <p className="text-sm text-[var(--muted)] text-center py-8">
                  {isCustomer ? "No ledger yet" : "Sign in as customer to see personal ledger, or sync for leaderboard"}
                </p>
              )}
            </div>
          </SpotlightCard>
        </div>
      </div>
    </>
  );
}
