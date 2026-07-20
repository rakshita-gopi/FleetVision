"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { FormPanel, Field } from "@/components/shared/form-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import api, { ApiResponse } from "@/lib/api";
import { Vehicle } from "@/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const emptyForm = {
  vehicle_number: "",
  registration_number: "",
  manufacturer: "",
  model: "",
  manufacturing_year: new Date().getFullYear(),
  fuel_type: "Diesel",
  vehicle_type: "Truck",
  status: "Available",
  odometer: 0,
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchVehicles = () => {
    api.get<ApiResponse<Vehicle[]>>("/vehicles/").then((res) => {
      setVehicles(res.data.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchVehicles(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setForm({
      vehicle_number: v.vehicle_number,
      registration_number: v.registration_number,
      manufacturer: v.manufacturer,
      model: v.model,
      manufacturing_year: v.manufacturing_year,
      fuel_type: v.fuel_type,
      vehicle_type: v.vehicle_type,
      status: v.status,
      odometer: v.odometer || 0,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        manufacturing_year: Number(form.manufacturing_year),
        odometer: Number(form.odometer),
      };
      if (editingId) {
        await api.patch(`/vehicles/${editingId}/`, payload);
        toast.success("Vehicle updated");
      } else {
        await api.post("/vehicles/", payload);
        toast.success("Vehicle added");
      }
      setShowForm(false);
      setEditingId(null);
      fetchVehicles();
    } catch {
      toast.error(editingId ? "Failed to update vehicle" : "Failed to add vehicle");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this vehicle?")) return;
    try {
      await api.delete(`/vehicles/${id}/`);
      toast.success("Vehicle deleted");
      fetchVehicles();
    } catch {
      toast.error("Failed to delete vehicle");
    }
  };

  return (
    <>
      <TopNav title="Vehicles" subtitle="Manage fleet inventory" />
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-[var(--muted)]">{vehicles.length} vehicles registered</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Vehicle
          </Button>
        </div>

        {showForm && (
          <FormPanel
            title={editingId ? "Edit Vehicle" : "Add Vehicle"}
            onSubmit={handleSave}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
            submitLabel={editingId ? "Update Vehicle" : "Save Vehicle"}
          >
            {[
              { key: "vehicle_number", label: "Vehicle Number" },
              { key: "registration_number", label: "Registration" },
              { key: "manufacturer", label: "Manufacturer" },
              { key: "model", label: "Model" },
            ].map((f) => (
              <Field key={f.key} label={f.label}>
                <Input
                  value={form[f.key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Year">
              <Input type="number" value={form.manufacturing_year} onChange={(e) => setForm({ ...form, manufacturing_year: Number(e.target.value) })} />
            </Field>
            <Field label="Odometer">
              <Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: Number(e.target.value) })} />
            </Field>
            <Field label="Fuel Type">
              <Select value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}>
                {["Diesel", "Petrol", "CNG", "Electric", "Hybrid"].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Vehicle Type">
              <Select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                {["Truck", "Van", "Car", "Bus", "Bike"].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["Available", "On Trip", "Under Maintenance", "Inactive"].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </FormPanel>
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
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEdit(row as unknown as Vehicle)}>
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
