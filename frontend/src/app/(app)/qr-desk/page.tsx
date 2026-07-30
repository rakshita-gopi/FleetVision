"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  CheckCircle2,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FormPanel, Field } from "@/components/shared/form-panel";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";
import api, { ApiResponse } from "@/lib/api";
import { Equipment, Operator, Site } from "@/types";
import { toast } from "sonner";

type Mode = "generate" | "scan";

interface ScanResult {
  valid: boolean;
  mode: "checkout" | "checkin" | "expired" | "invalid";
  message: string;
  rental_id: string;
  transaction_id?: string;
  rental_status?: string;
  expected_return_date?: string | null;
  customer?: { id?: string; name?: string };
  operator?: { id?: string | null; name?: string | null };
  site?: { id?: string | null; name?: string | null };
  equipment?: {
    asset_id: string;
    status: string;
    engine_hours: number;
    model?: string;
    category?: string;
    health?: string;
    fuel_level?: number | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  invoice_number?: string;
  daily_rate?: number;
}

interface OpenRental {
  rental_id: string;
  transaction_id?: string;
  asset_id: string;
  status: string;
  customer_name?: string;
  operator_name?: string | null;
  expected_return_date?: string | null;
  qr_payload: string;
}

export default function QrDeskPage() {
  const [tab, setTab] = useState<Mode>("generate");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [openRentals, setOpenRentals] = useState<OpenRental[]>([]);
  const [form, setForm] = useState({
    equipment_id: "",
    operator_id: "",
    site_id: "",
    customer_id: "",
    customer_name: "",
    expected_return_date: "",
    daily_rate: "650",
  });
  const [generated, setGenerated] = useState<{
    rental_id: string;
    transaction_id?: string;
    qr_payload: string;
    asset_id?: string;
  } | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanBoxId = "qr-desk-reader";

  const loadOpen = useCallback(() => {
    api.get<ApiResponse<OpenRental[]>>("/qr-desk/open/").then((res) => {
      setOpenRentals(res.data.data || []);
    });
  }, []);

  useEffect(() => {
    api.get<ApiResponse<Equipment[]>>("/equipment/?status=AVAILABLE").then((r) => setEquipment(r.data.data || []));
    api.get<ApiResponse<Operator[]>>("/operators/").then((r) => setOperators(r.data.data || []));
    api.get<ApiResponse<Site[]>>("/sites/").then((r) => setSites(r.data.data || []));
    loadOpen();
  }, [loadOpen]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setScanning(false);
  };

  const handleGenerate = async () => {
    if (!form.equipment_id) {
      toast.error("Select equipment");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<
        ApiResponse<{ rental_id: string; transaction_id?: string; qr_payload: string; asset_id?: string }>
      >("/qr-desk/generate/", {
        ...form,
        daily_rate: Number(form.daily_rate),
      });
      const data = res.data.data!;
      setGenerated({
        rental_id: data.rental_id,
        transaction_id: data.transaction_id,
        qr_payload: data.qr_payload || data.rental_id,
        asset_id: data.asset_id,
      });
      toast.success(`QR ready for ${data.rental_id}`);
      loadOpen();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to generate QR";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runScan = async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    setBusy(true);
    try {
      const res = await api.post<ApiResponse<ScanResult>>("/qr-desk/scan/", { code: cleaned });
      setScan(res.data.data || null);
      setManualCode(cleaned);
      if (!res.data.success) {
        toast.error(res.data.message || "QR invalid");
      }
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { data?: ScanResult; message?: string } } })?.response?.data;
      if (data?.data) setScan(data.data);
      toast.error(data?.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    setTab("scan");
    await stopCamera();
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(scanBoxId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          await stopCamera();
          await runScan(decoded);
        },
        () => undefined
      );
    } catch {
      setScanning(false);
      toast.error("Camera unavailable — enter rental ID manually");
    }
  };

  const confirmAction = async () => {
    if (!scan?.rental_id || !scan.valid) return;
    setBusy(true);
    try {
      const path = scan.mode === "checkout" ? "/qr-desk/confirm-checkout/" : "/qr-desk/confirm-checkin/";
      const res = await api.post<ApiResponse<{ invoice_number?: string; rental_status?: string }>>(path, {
        rental_id: scan.rental_id,
        notes,
        latitude: scan.equipment?.latitude,
        longitude: scan.equipment?.longitude,
        engine_hours: scan.equipment?.engine_hours,
        fuel_level: scan.equipment?.fuel_level,
      });
      toast.success(res.data.message || "Confirmed");
      if (res.data.data?.invoice_number) {
        toast.message(`Invoice ${res.data.data.invoice_number}`);
      }
      await runScan(scan.rental_id);
      loadOpen();
      setNotes("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Confirm failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopNav title="QR Check-In / Out" subtitle="Generate checkout QR · scan to possess or return" />
      <div className="p-6 lg:p-8 space-y-6">
        <SpotlightCard className="p-5" spotlightColor="rgba(212, 160, 23, 0.2)">
          <h2 className="text-xl font-bold">
            <GradientText>QR possession desk</GradientText>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">
            Manager generates a QR containing only the rental ID. Operator scans to confirm checkout (rental starts)
            or later to check in (return → invoice → QR expires).
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant={tab === "generate" ? "primary" : "outline"}
              onClick={() => {
                stopCamera();
                setTab("generate");
              }}
            >
              <QrCode className="h-4 w-4" /> Generate Check-Out QR
            </Button>
            <Button
              variant={tab === "scan" ? "primary" : "outline"}
              onClick={() => setTab("scan")}
            >
              <ScanLine className="h-4 w-4" /> Operator Scan
            </Button>
            <Button variant="ghost" onClick={loadOpen}>
              <RefreshCw className="h-4 w-4" /> Refresh open
            </Button>
          </div>
        </SpotlightCard>

        {tab === "generate" ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <FormPanel
              title="Create pending checkout"
              onSubmit={handleGenerate}
              onCancel={() => setForm({ ...form, equipment_id: "", customer_name: "" })}
              submitLabel={busy ? "Generating…" : "Generate Check-Out QR"}
            >
              <Field label="Equipment">
                <Select
                  value={form.equipment_id}
                  onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                  required
                >
                  <option value="">Select available asset</option>
                  {equipment.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.asset_id} — {e.model_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Operator">
                <Select value={form.operator_id} onChange={(e) => setForm({ ...form, operator_id: e.target.value })}>
                  <option value="">Optional</option>
                  {operators.map((o) => (
                    <option key={o.id} value={o.operator_id}>
                      {o.operator_id} — {o.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Site">
                <Select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })}>
                  <option value="">Optional</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.site_id}>
                      {s.site_id} — {s.site_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Customer ID">
                <Input
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  placeholder="CUST120"
                />
              </Field>
              <Field label="Customer name">
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Acme Earthworks"
                />
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

            <SpotlightCard className="p-6 flex flex-col items-center justify-center min-h-[360px]" spotlightColor="rgba(13, 148, 136, 0.15)">
              {generated ? (
                <>
                  <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-2">QR payload</p>
                  <p className="text-2xl font-bold text-[var(--foreground)] mb-1">{generated.qr_payload}</p>
                  {generated.transaction_id && (
                    <p className="text-xs text-[var(--muted)] mb-4">{generated.transaction_id}</p>
                  )}
                  <div className="rounded-2xl bg-white p-4 shadow-sm border border-[var(--border)]">
                    <QRCodeSVG value={generated.qr_payload} size={220} level="M" includeMargin />
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-4 text-center">
                    Status: <Badge status="PENDING_CHECKOUT" /> — operator scans to take possession
                  </p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => {
                      setTab("scan");
                      setManualCode(generated.qr_payload);
                      runScan(generated.qr_payload);
                    }}
                  >
                    Test scan this QR
                  </Button>
                </>
              ) : (
                <div className="text-center text-[var(--muted)] space-y-2">
                  <QrCode className="h-12 w-12 mx-auto opacity-40" />
                  <p>Generate a check-out QR to display it here.</p>
                </div>
              )}
            </SpotlightCard>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SpotlightCard className="p-6 space-y-4" spotlightColor="rgba(212, 160, 23, 0.18)">
              <h3 className="font-semibold text-[var(--foreground)]">Scan rental QR</h3>
              <div id={scanBoxId} className="w-full overflow-hidden rounded-2xl bg-black/5 min-h-[240px]" />
              <div className="flex flex-wrap gap-2">
                {!scanning ? (
                  <Button onClick={startCamera}>
                    <Camera className="h-4 w-4" /> Start camera
                  </Button>
                ) : (
                  <Button variant="outline" onClick={stopCamera}>
                    Stop camera
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Or type RNT10452 / TXN-…"
                  onKeyDown={(e) => e.key === "Enter" && runScan(manualCode)}
                />
                <Button onClick={() => runScan(manualCode)} disabled={busy}>
                  Lookup
                </Button>
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-6 space-y-4" spotlightColor="rgba(22, 163, 74, 0.12)">
              {!scan ? (
                <div className="text-center text-[var(--muted)] py-16">
                  <ScanLine className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  Scan or enter a rental ID to load checkout / return context.
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Rental</p>
                      <p className="text-xl font-bold">{scan.rental_id}</p>
                      {scan.transaction_id && (
                        <p className="text-xs text-[var(--muted)]">{scan.transaction_id}</p>
                      )}
                    </div>
                    <Badge status={scan.rental_status || scan.mode.toUpperCase()} />
                  </div>
                  <p
                    className={`text-sm rounded-xl px-3 py-2 ${
                      scan.valid ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"
                    }`}
                  >
                    {scan.valid ? (
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> {scan.message}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" /> {scan.message}
                      </span>
                    )}
                  </p>

                  {scan.equipment && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-[var(--muted-bg)] p-3">
                        <p className="text-xs text-[var(--muted)]">Equipment</p>
                        <p className="font-semibold">{scan.equipment.asset_id}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {scan.equipment.model} · {scan.equipment.category}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--muted-bg)] p-3">
                        <p className="text-xs text-[var(--muted)]">Health / fuel</p>
                        <p className="font-semibold">{scan.equipment.health || "—"}</p>
                        <p className="text-xs text-[var(--muted)]">
                          Fuel {scan.equipment.fuel_level ?? "—"}% · {scan.equipment.engine_hours} hrs
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--muted-bg)] p-3">
                        <p className="text-xs text-[var(--muted)]">Customer</p>
                        <p className="font-semibold">{scan.customer?.name || scan.customer?.id || "—"}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--muted-bg)] p-3">
                        <p className="text-xs text-[var(--muted)]">Operator / site</p>
                        <p className="font-semibold">{scan.operator?.name || "—"}</p>
                        <p className="text-xs text-[var(--muted)]">{scan.site?.id || "—"}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--muted-bg)] p-3 col-span-2">
                        <p className="text-xs text-[var(--muted)]">Location</p>
                        <p className="font-medium">
                          {scan.equipment.latitude != null
                            ? `${Number(scan.equipment.latitude).toFixed(5)}, ${Number(scan.equipment.longitude).toFixed(5)}`
                            : "No live GPS — will store on confirm if available"}
                        </p>
                      </div>
                    </div>
                  )}

                  {scan.invoice_number && (
                    <p className="text-sm font-medium">Invoice: {scan.invoice_number}</p>
                  )}

                  {scan.valid && (
                    <>
                      <Field label="Notes (optional)">
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condition notes" />
                      </Field>
                      <Button className="w-full" onClick={confirmAction} disabled={busy}>
                        {scan.mode === "checkout" ? "Confirm Checkout" : "Confirm Check-In / Return"}
                      </Button>
                    </>
                  )}
                </>
              )}
            </SpotlightCard>
          </div>
        )}

        <SpotlightCard className="p-5" spotlightColor="rgba(120, 113, 108, 0.12)">
          <h3 className="font-semibold mb-3 text-[var(--foreground)]">Open QR rentals</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="py-2 pr-3">Rental</th>
                  <th className="py-2 pr-3">Txn</th>
                  <th className="py-2 pr-3">Asset</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {openRentals.map((r) => (
                  <tr key={r.rental_id} className="border-b border-[var(--border)]/60">
                    <td className="py-2.5 pr-3 font-medium">{r.rental_id}</td>
                    <td className="py-2.5 pr-3 text-[var(--muted)] text-xs">{r.transaction_id || "—"}</td>
                    <td className="py-2.5 pr-3">{r.asset_id}</td>
                    <td className="py-2.5 pr-3">{r.customer_name || "—"}</td>
                    <td className="py-2.5 pr-3">
                      <Badge status={r.status} />
                    </td>
                    <td className="py-2.5">
                      <button
                        className="text-xs font-medium"
                        style={{ color: "var(--primary)" }}
                        onClick={() => {
                          setGenerated({
                            rental_id: r.rental_id,
                            transaction_id: r.transaction_id,
                            qr_payload: r.qr_payload,
                            asset_id: r.asset_id,
                          });
                          setTab("generate");
                        }}
                      >
                        Show QR
                      </button>
                    </td>
                  </tr>
                ))}
                {openRentals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--muted)]">
                      No pending or active QR rentals
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      </div>
    </>
  );
}
