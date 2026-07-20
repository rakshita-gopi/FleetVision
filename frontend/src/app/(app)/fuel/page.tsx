"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { FormPanel, Field } from "@/components/shared/form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api, { ApiResponse } from "@/lib/api";
import { FuelLog, Vehicle, Driver } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

const emptyForm = {
  vehicle: "",
  driver: "",
  fuel_station: "",
  fuel_quantity: 0,
  fuel_cost: 0,
  mileage: 0,
  fuel_date: new Date().toISOString().slice(0, 10),
};

export default function FuelPage() {
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    try {
      const [fRes, vRes, dRes] = await Promise.all([
        api.get<ApiResponse<FuelLog[]>>("/fuel/"),
        api.get<ApiResponse<Vehicle[]>>("/vehicles/"),
        api.get<ApiResponse<Driver[]>>("/drivers/"),
      ]);
      setLogs(fRes.data.data || []);
      setVehicles(vRes.data.data || []);
      setDrivers(dRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (log: FuelLog) => {
    setEditingId(log.id);
    setForm({
      vehicle: log.vehicle || "",
      driver: log.driver || "",
      fuel_station: log.fuel_station || "",
      fuel_quantity: Number(log.fuel_quantity),
      fuel_cost: Number(log.fuel_cost),
      mileage: Number(log.mileage),
      fuel_date: log.fuel_date || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.vehicle) {
      toast.error("Vehicle is required");
      return;
    }
    const payload = {
      vehicle: form.vehicle,
      driver: form.driver || null,
      fuel_station: form.fuel_station,
      fuel_quantity: Number(form.fuel_quantity),
      fuel_cost: Number(form.fuel_cost),
      mileage: Number(form.mileage),
      fuel_date: form.fuel_date,
    };
    try {
      if (editingId) {
        await api.patch(`/fuel/${editingId}/`, payload);
        toast.success("Fuel log updated");
      } else {
        await api.post("/fuel/", payload);
        toast.success("Fuel log added");
      }
      setShowForm(false);
      setEditingId(null);
      await fetchAll();
    } catch {
      toast.error("Failed to save fuel log");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this fuel entry?")) return;
    try {
      await api.delete(`/fuel/${id}/`);
      toast.success("Fuel log deleted");
      await fetchAll();
    } catch {
      toast.error("Failed to delete fuel log");
    }
  };

  const monthlyCost = logs.reduce((sum, l) => sum + Number(l.fuel_cost), 0);
  const chartData = logs.slice(0, 6).map((l) => ({
    vehicle: l.vehicle_number || "Unknown",
    cost: Number(l.fuel_cost),
  }));

  return (
    <>
      <TopNav title="Fuel Management" subtitle="Fuel consumption and cost tracking" />
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 mr-4">
            <Card><CardHeader><CardTitle className="text-2xl">{formatCurrency(monthlyCost)}</CardTitle><p className="text-xs text-[var(--muted)]">Total Fuel Cost</p></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-2xl">{logs.length}</CardTitle><p className="text-xs text-[var(--muted)]">Fuel Entries</p></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-2xl">{logs.length ? (logs.reduce((s, l) => s + Number(l.mileage), 0) / logs.length).toFixed(1) : 0} km/L</CardTitle><p className="text-xs text-[var(--muted)]">Avg Mileage</p></CardHeader></Card>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4" /> Add Entry
          </Button>
        </div>

        {showForm && (
          <FormPanel
            title={editingId ? "Edit Fuel Entry" : "Add Fuel Entry"}
            onSubmit={handleSave}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
            submitLabel={editingId ? "Update" : "Save"}
          >
            <Field label="Vehicle">
              <Select value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                <option value="">Select vehicle</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
              </Select>
            </Field>
            <Field label="Driver">
              <Select value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })}>
                <option value="">Optional</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Fuel Station">
              <Input value={form.fuel_station} onChange={(e) => setForm({ ...form, fuel_station: e.target.value })} />
            </Field>
            <Field label="Quantity (L)">
              <Input type="number" value={form.fuel_quantity} onChange={(e) => setForm({ ...form, fuel_quantity: Number(e.target.value) })} />
            </Field>
            <Field label="Cost">
              <Input type="number" value={form.fuel_cost} onChange={(e) => setForm({ ...form, fuel_cost: Number(e.target.value) })} />
            </Field>
            <Field label="Mileage (km/L)">
              <Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: Number(e.target.value) })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.fuel_date} onChange={(e) => setForm({ ...form, fuel_date: e.target.value })} />
            </Field>
          </FormPanel>
        )}

        <Card>
          <CardHeader><CardTitle>Fuel Cost by Vehicle</CardTitle></CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="vehicle" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px" }} />
                <Bar dataKey="cost" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <DataTable
          loading={loading}
          data={logs as unknown as Record<string, unknown>[]}
          columns={[
            { key: "vehicle_number", label: "Vehicle" },
            { key: "driver_name", label: "Driver" },
            { key: "fuel_quantity", label: "Quantity (L)" },
            { key: "fuel_cost", label: "Cost", render: (row) => formatCurrency(Number(row.fuel_cost)) },
            { key: "mileage", label: "Mileage" },
            { key: "fuel_date", label: "Date", render: (row) => formatDate(row.fuel_date as string) },
          ]}
          actions={(row) => (
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEdit(row as unknown as FuelLog)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id as string)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        />
      </div>
    </>
  );
}
