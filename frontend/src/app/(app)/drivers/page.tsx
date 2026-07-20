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
import { Driver, Vehicle } from "@/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  license_number: "",
  license_expiry: "",
  address: "",
  emergency_contact: "",
  blood_group: "",
  experience_years: 0,
  joining_date: new Date().toISOString().slice(0, 10),
  status: "Available",
  assigned_vehicle: "",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    try {
      const [dRes, vRes] = await Promise.all([
        api.get<ApiResponse<Driver[]>>("/drivers/"),
        api.get<ApiResponse<Vehicle[]>>("/vehicles/"),
      ]);
      setDrivers(dRes.data.data || []);
      setVehicles(vRes.data.data || []);
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

  const openEdit = (driver: Driver) => {
    setEditingId(driver.id);
    setForm({
      full_name: driver.name || "",
      email: driver.email || "",
      phone: driver.phone || "",
      password: "",
      license_number: driver.license_number || "",
      license_expiry: driver.license_expiry || "",
      address: driver.address || "",
      emergency_contact: driver.emergency_contact || "",
      blood_group: driver.blood_group || "",
      experience_years: driver.experience_years || 0,
      joining_date: driver.joining_date || "",
      status: driver.status || "Available",
      assigned_vehicle: driver.assigned_vehicle || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await api.patch(`/drivers/${editingId}/`, {
          full_name: form.full_name,
          phone: form.phone,
          license_number: form.license_number,
          license_expiry: form.license_expiry,
          address: form.address,
          emergency_contact: form.emergency_contact,
          blood_group: form.blood_group,
          experience_years: Number(form.experience_years),
          joining_date: form.joining_date,
          status: form.status,
          assigned_vehicle: form.assigned_vehicle || null,
        });
        toast.success("Driver updated");
      } else {
        if (!form.password) {
          toast.error("Password is required for new drivers");
          return;
        }
        await api.post("/drivers/", {
          ...form,
          experience_years: Number(form.experience_years),
          assigned_vehicle: form.assigned_vehicle || null,
        });
        toast.success("Driver added");
      }
      setShowForm(false);
      setEditingId(null);
      await fetchAll();
    } catch {
      toast.error(editingId ? "Failed to update driver" : "Failed to add driver");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this driver? Their login account will also be removed.")) return;
    try {
      await api.delete(`/drivers/${id}/`);
      toast.success("Driver deleted");
      await fetchAll();
    } catch {
      toast.error("Failed to delete driver");
    }
  };

  return (
    <>
      <TopNav title="Drivers" subtitle="Driver profiles and assignments" />
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-[var(--muted)]">{drivers.length} drivers registered</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Driver
          </Button>
        </div>

        {showForm && (
          <FormPanel
            title={editingId ? "Edit Driver" : "Add Driver"}
            onSubmit={handleSave}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
            submitLabel={editingId ? "Update Driver" : "Save Driver"}
          >
            <Field label="Full Name">
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} disabled={!!editingId} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            {!editingId && (
              <Field label="Password">
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
            )}
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="License Number">
              <Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
            </Field>
            <Field label="License Expiry">
              <Input type="date" value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} />
            </Field>
            <Field label="Joining Date">
              <Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
            </Field>
            <Field label="Experience (years)">
              <Input type="number" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: Number(e.target.value) })} />
            </Field>
            <Field label="Blood Group">
              <Input value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} />
            </Field>
            <Field label="Emergency Contact">
              <Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["Available", "On Trip", "On Leave", "Inactive"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned Vehicle">
              <Select value={form.assigned_vehicle} onChange={(e) => setForm({ ...form, assigned_vehicle: e.target.value })}>
                <option value="">None</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.vehicle_number} — {v.manufacturer} {v.model}</option>
                ))}
              </Select>
            </Field>
          </FormPanel>
        )}

        <DataTable
          loading={loading}
          data={drivers as unknown as Record<string, unknown>[]}
          columns={[
            { key: "name", label: "Name" },
            { key: "license_number", label: "License No." },
            { key: "phone", label: "Phone" },
            { key: "assigned_vehicle_number", label: "Vehicle", render: (row) => (row.assigned_vehicle_number as string) || "—" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status as string} /> },
            { key: "license_expiry", label: "License Expiry", render: (row) => formatDate(row.license_expiry as string) },
          ]}
          actions={(row) => (
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEdit(row as unknown as Driver)}>
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
