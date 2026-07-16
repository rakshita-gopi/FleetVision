"use client";

import { useEffect, useState } from "react";
import { Play, CheckCircle, XCircle } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api, { ApiResponse } from "@/lib/api";
import { Trip } from "@/types";
import { toast } from "sonner";

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = () => {
    api.get<ApiResponse<Trip[]>>("/trips/").then((res) => {
      setTrips(res.data.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTrips(); }, []);

  const tripAction = async (id: string, action: "start" | "complete" | "cancel") => {
    try {
      await api.put(`/trips/${id}/${action}/`);
      toast.success(`Trip ${action}ed`);
      fetchTrips();
    } catch {
      toast.error(`Failed to ${action} trip`);
    }
  };

  return (
    <>
      <TopNav title="Trips" subtitle="Trip scheduling and monitoring" />
      <div className="p-8">
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
            </div>
          )}
        />
      </div>
    </>
  );
}
