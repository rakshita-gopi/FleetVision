"use client";

import { useEffect, useState } from "react";
import { Plus, Play, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { FormPanel, Field } from "@/components/shared/form-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import api, { ApiResponse } from "@/lib/api";
import { Trip, Vehicle, Driver } from "@/types";
import { toast } from "sonner";

const emptyForm = {
  vehicle: "",
  driver: "",
  source: "",
  destination: "",
  distance: 0,
  trip_status: "Scheduled",
};

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    try {
      const [tRes, vRes, dRes] = await Promise.all([
        api.get<ApiResponse<Trip[]>>("/trips/"),
        api.get<ApiResponse<Vehicle[]>>("/vehicles/"),
        api.get<ApiResponse<Driver[]>>("/drivers/"),
      ]);
      setTrips(tRes.data.data || []);
      setVehicles(vRes.data.data || []);
      setDrivers(dRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    if (!form.vehicle || !form.driver || !form.source || !form.destination) {
      toast.error("Vehicle, driver, source, and destination are required");
      return;
    }
    try {
      await api.post("/trips/", {
        ...form,
        distance: Number(form.distance),
      });
      toast.success("Trip scheduled");
      setShowForm(false);
      setForm(emptyForm);
      await fetchAll();
    } catch {
      toast.error("Failed to create trip");
    }
  };

  const tripAction = async (id: string, action: "start" | "complete" | "cancel") => {
    try {
      await api.put(`/trips/${id}/${action}/`);
      toast.success(`Trip ${action}ed`);
      await fetchAll();
    } catch {
      toast.error(`Failed to ${action} trip`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this trip?")) return;
    try {
      await api.delete(`/trips/${id}/`);
      toast.success("Trip deleted");
      await fetchAll();
    } catch {
      toast.error("Failed to delete trip");
    }
  };

  return (
    <>
      <TopNav title="Trips" subtitle="Trip scheduling and monitoring" />
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-[var(--muted)]">{trips.length} trips</p>
          <Button onClick={() => { setForm(emptyForm); setShowForm(!showForm); }}>
            <Plus className="h-4 w-4" /> Schedule Trip
          </Button>
        </div>

        {showForm && (
          <FormPanel title="Schedule Trip" onSubmit={handleCreate} onCancel={() => setShowForm(false)} submitLabel="Create Trip">
            <Field label="Vehicle">
              <Select value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                <option value="">Select vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.vehicle_number}</option>
                ))}
              </Select>
            </Field>
            <Field label="Driver">
              <Select value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })}>
                <option value="">Select driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Source">
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </Field>
            <Field label="Destination">
              <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </Field>
            <Field label="Distance (km)">
              <Input type="number" value={form.distance} onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })} />
            </Field>
          </FormPanel>
        )}

        <DataTable
          loading={loading}
          data={trips as unknown as Record<string, unknown>[]}
          columns={[
            { key: "vehicle_number", label: "Vehicle" },
            { key: "driver_name", label: "Driver" },
            { key: "source", label: "Source" },
            { key: "destination", label: "Destination" },
            { key: "distance", label: "Distance (km)" },
            { key: "trip_status", label: "Status", render: (row) => <Badge status={row.trip_status as string} /> },
          ]}
          actions={(row) => (
            <div className="flex gap-1 justify-end">
              {row.trip_status === "Scheduled" && (
                <Button variant="ghost" size="sm" onClick={() => tripAction(row.id as string, "start")}>
                  <Play className="h-3.5 w-3.5" />
                </Button>
              )}
              {(row.trip_status === "In Progress" || row.trip_status === "Started") && (
                <Button variant="ghost" size="sm" onClick={() => tripAction(row.id as string, "complete")}>
                  <CheckCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              {row.trip_status !== "Completed" && row.trip_status !== "Cancelled" && (
                <Button variant="ghost" size="sm" onClick={() => tripAction(row.id as string, "cancel")}>
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                </Button>
              )}
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
