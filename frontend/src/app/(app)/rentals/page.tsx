"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormPanel, Field } from "@/components/shared/form-panel";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import api, { ApiResponse } from "@/lib/api";
import { Equipment, Rental, Site, Operator } from "@/types";
import { toast } from "sonner";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [form, setForm] = useState({
    equipment_id: "",
    site_id: "",
    operator_id: "",
    expected_return_date: "",
    daily_rate: "500",
  });

  const load = () => {
    setLoading(true);
    api
      .get<ApiResponse<Rental[]>>("/rentals/")
      .then((res) => setRentals(res.data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get<ApiResponse<Equipment[]>>("/equipment/?status=AVAILABLE").then((r) => setEquipment(r.data.data || []));
    api.get<ApiResponse<Site[]>>("/sites/").then((r) => setSites(r.data.data || []));
    api.get<ApiResponse<Operator[]>>("/operators/").then((r) => setOperators(r.data.data || []));
  }, []);

  const checkIn = async (id: string) => {
    try {
      await api.post(`/rentals/${id}/check-in/`);
      toast.success("Checked in");
      load();
    } catch {
      toast.error("Check-in failed");
    }
  };

  const checkOut = async () => {
    try {
      await api.post("/rentals/check-out/", {
        ...form,
        daily_rate: Number(form.daily_rate),
      });
      toast.success("Checked out");
      setShowCheckout(false);
      load();
    } catch {
      toast.error("Check-out failed");
    }
  };

  return (
    <>
      <TopNav title="Rentals" subtitle="Check-in / check-out board" />
      <div className="p-8 space-y-6">
        <SpotlightCard className="p-5" spotlightColor="rgba(212, 160, 23, 0.18)">
          <h2 className="text-lg font-bold">
            <GradientText>Manage contracts like a yard desk</GradientText>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Check out available iron, track expected returns, and close overdue rentals fast.
          </p>
        </SpotlightCard>
        <div className="flex justify-between items-center">
          <p className="text-sm text-[var(--muted)]">{rentals.length} rentals</p>
          <Button onClick={() => setShowCheckout(true)}>Check out equipment</Button>
        </div>

        {showCheckout && (
          <FormPanel title="Check out" onSubmit={checkOut} onCancel={() => setShowCheckout(false)} submitLabel="Confirm checkout">
            <Field label="Equipment">
              <Select
                value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                required
              >
                <option value="">Select asset</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.asset_id} — {e.model_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Site">
              <Select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })}>
                <option value="">Optional site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.site_id}>
                    {s.site_id} — {s.site_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Operator">
              <Select value={form.operator_id} onChange={(e) => setForm({ ...form, operator_id: e.target.value })}>
                <option value="">Optional operator</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.operator_id}>
                    {o.operator_id} — {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expected return">
              <Input
                type="date"
                value={form.expected_return_date}
                onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })}
              />
            </Field>
            <Field label="Daily rate">
              <Input
                type="number"
                value={form.daily_rate}
                onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
              />
            </Field>
          </FormPanel>
        )}

        <DataTable
          loading={loading}
          data={rentals as unknown as Record<string, unknown>[]}
          columns={[
            { key: "rental_id", label: "Rental" },
            { key: "asset_id", label: "Asset" },
            { key: "site_id", label: "Site" },
            { key: "operator_id", label: "Operator" },
            { key: "check_out_date", label: "Out" },
            { key: "expected_return_date", label: "Due" },
            {
              key: "rental_status",
              label: "Status",
              render: (row) => <Badge status={String(row.rental_status)} />,
            },
            {
              key: "daily_rate",
              label: "Rate",
              render: (row) => `₹${Number(row.daily_rate || 0).toFixed(0)}`,
            },
          ]}
          actions={(row) =>
            row.rental_status === "ACTIVE" && !row.actual_return_date ? (
              <Button size="sm" variant="outline" onClick={() => checkIn(String(row.id))}>
                Check in
              </Button>
            ) : null
          }
        />
      </div>
    </>
  );
}
