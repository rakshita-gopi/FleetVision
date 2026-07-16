"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import api, { ApiResponse } from "@/lib/api";
import { Vehicle } from "@/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vehicle_number: "", registration_number: "", manufacturer: "", model: "",
    manufacturing_year: new Date().getFullYear(), fuel_type: "Diesel", vehicle_type: "Truck", status: "Available",
  });

  const fetchVehicles = () => {
    api.get<ApiResponse<Vehicle[]>>("/vehicles/").then((res) => {
      setVehicles(res.data.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchVehicles(); }, []);

  const handleCreate = async () => {
    try {
      await api.post("/vehicles/", form);
      toast.success("Vehicle added");
      setShowForm(false);
      fetchVehicles();
    } catch {
      toast.error("Failed to add vehicle");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this vehicle?")) return;
    await api.delete(`/vehicles/${id}/`);
    toast.success("Vehicle deleted");
    fetchVehicles();
  };

  return (
    <>
      <TopNav title="Vehicles" subtitle="Manage fleet inventory" />
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-[var(--muted)]">{vehicles.length} vehicles registered</p>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Add Vehicle
          </Button>
        </div>

        {showForm && (
          <div className="glass-card rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: "vehicle_number", label: "Vehicle Number" },
              { key: "registration_number", label: "Registration" },
              { key: "manufacturer", label: "Manufacturer" },
              { key: "model", label: "Model" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs text-[var(--muted)] mb-1 block">{f.label}</label>
                <Input
                  value={form[f.key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
            <div className="md:col-span-3 flex gap-3">
              <Button onClick={handleCreate}>Save Vehicle</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <DataTable
          loading={loading}
          data={vehicles as unknown as Record<string, unknown>[]}
          columns={[
            { key: "vehicle_number", label: "Vehicle No." },
            { key: "manufacturer", label: "Manufacturer" },
            { key: "model", label: "Model" },
            { key: "fuel_type", label: "Fuel Type" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status as string} /> },
            { key: "insurance_expiry", label: "Insurance", render: (row) => row.insurance_expiry ? formatDate(row.insurance_expiry as string) : "—" },
          ]}
          actions={(row) => (
            <div className="flex gap-2 justify-end">
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
