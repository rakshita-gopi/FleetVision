"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { FormPanel, Field } from "@/components/shared/form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import api, { ApiResponse } from "@/lib/api";
import { MaintenanceRecord, Vehicle } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

const emptyForm = {
  vehicle: "",
  mechanic_name: "",
  service_type: "",
  service_date: new Date().toISOString().slice(0, 10),
  next_service_date: "",
  repair_cost: 0,
  remarks: "",
};

export default function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    try {
      const [mRes, vRes] = await Promise.all([
        api.get<ApiResponse<MaintenanceRecord[]>>("/maintenance/"),
        api.get<ApiResponse<Vehicle[]>>("/vehicles/"),
      ]);
      setRecords(mRes.data.data || []);
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

  const openEdit = (rec: MaintenanceRecord) => {
    setEditingId(rec.id);
    setForm({
      vehicle: rec.vehicle || "",
      mechanic_name: rec.mechanic_name || "",
      service_type: rec.service_type || "",
      service_date: rec.service_date || "",
      next_service_date: rec.next_service_date || "",
      repair_cost: Number(rec.repair_cost),
      remarks: rec.remarks || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.vehicle || !form.service_type) {
      toast.error("Vehicle and service type are required");
      return;
    }
    const payload = {
      ...form,
      repair_cost: Number(form.repair_cost),
      next_service_date: form.next_service_date || null,
    };
    try {
      if (editingId) {
        await api.patch(`/maintenance/${editingId}/`, payload);
        toast.success("Maintenance record updated");
      } else {
        await api.post("/maintenance/", payload);
        toast.success("Maintenance record added");
      }
      setShowForm(false);
      setEditingId(null);
      await fetchAll();
    } catch {
      toast.error("Failed to save maintenance record");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this maintenance record?")) return;
    try {
      await api.delete(`/maintenance/${id}/`);
      toast.success("Record deleted");
      await fetchAll();
    } catch {
      toast.error("Failed to delete record");
    }
  };

  return (
    <>
      <TopNav title="Maintenance" subtitle="Service records and scheduling" />
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-[var(--muted)]">{records.length} service records</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Record
          </Button>
        </div>

        {showForm && (
          <FormPanel
            title={editingId ? "Edit Maintenance" : "Add Maintenance"}
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
            <Field label="Service Type">
              <Input value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} placeholder="Oil Change, Brake Service..." />
            </Field>
            <Field label="Mechanic">
              <Input value={form.mechanic_name} onChange={(e) => setForm({ ...form, mechanic_name: e.target.value })} />
            </Field>
            <Field label="Service Date">
              <Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} />
            </Field>
            <Field label="Next Service">
              <Input type="date" value={form.next_service_date} onChange={(e) => setForm({ ...form, next_service_date: e.target.value })} />
            </Field>
            <Field label="Cost">
              <Input type="number" value={form.repair_cost} onChange={(e) => setForm({ ...form, repair_cost: Number(e.target.value) })} />
            </Field>
            <Field label="Remarks">
              <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>
          </FormPanel>
        )}

        <DataTable
          loading={loading}
          data={records as unknown as Record<string, unknown>[]}
          columns={[
            { key: "vehicle_number", label: "Vehicle" },
            { key: "service_type", label: "Service Type" },
            { key: "mechanic_name", label: "Mechanic" },
            { key: "service_date", label: "Service Date", render: (row) => formatDate(row.service_date as string) },
            { key: "next_service_date", label: "Next Service", render: (row) => row.next_service_date ? formatDate(row.next_service_date as string) : "—" },
            { key: "repair_cost", label: "Cost", render: (row) => formatCurrency(Number(row.repair_cost)) },
          ]}
          actions={(row) => (
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEdit(row as unknown as MaintenanceRecord)}>
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
