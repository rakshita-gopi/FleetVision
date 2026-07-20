"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Bot,
  Download,
  FileText,
  History,
  RotateCcw,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api, { ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type ChatRole = "user" | "assistant" | "system";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  suggestions?: string[];
};

type ReportConfig = {
  report_type: string;
  format: "pdf" | "json" | "csv";
  lookback_days: number;
  sections: string[];
  custom_tables?: string[];
};

type ChatTurn = {
  reply: string;
  ready: boolean;
  config: ReportConfig | null;
  state: Record<string, unknown>;
};

type ReportHistory = {
  id: string;
  report_type: string;
  sections: string[];
  default_format: "pdf" | "json" | "csv";
  created_at: string;
  preview: string;
};

type ReportPreview = {
  id: string;
  report_type: string;
  llm_summary: string;
  payload: {
    analytics?: Record<string, number | string>;
    tables?: Record<string, Record<string, unknown>[]>;
    charts?: Record<string, Record<string, unknown>[]>;
  };
  created_at: string;
};

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi — I'm your FleetVision Report Assistant. Tell me what report you need, and I'll ask a few quick questions, then generate it for you.\n\nWhat would you like to start with?",
  suggestions: [
    "Overall fleet report",
    "Fuel cost analysis",
    "Driver performance",
    "Custom report",
  ],
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ReportsPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<ReportHistory[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportPreview | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<ReportHistory[]>>("/reports/history");
      setHistory(res.data.data || []);
    } catch {
      /* ignore quiet load failures */
    }
  }, []);

  useEffect(() => {
    api.get<ApiResponse<ReportHistory[]>>("/reports/history").then((res) => {
      setHistory(res.data.data || []);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, generating]);

  const resetChat = () => {
    setMessages([{ ...WELCOME, id: uid() }]);
    setChatState({});
    setInput("");
  };

  const openPreview = async (id: string) => {
    try {
      const res = await api.get<ApiResponse<ReportPreview>>(`/reports/${id}/preview`);
      setSelectedReport(res.data.data || null);
    } catch {
      toast.error("Failed to load report preview");
    }
  };

  const redownload = async (id: string, exportFormat: "pdf" | "json" | "csv") => {
    try {
      const res = await api.get(`/reports/${id}/download?format=${exportFormat}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `fleetvision-${id}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const runGenerate = async (config: ReportConfig) => {
    setGenerating(true);
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant",
        content: `Generating your **${config.report_type}** report as **${config.format.toUpperCase()}**… This may take a moment.`,
      },
    ]);
    try {
      const res = await api.post(
        "/reports/generate",
        {
          report_type: config.report_type,
          format: config.format,
          sections: config.sections,
          filters: {
            lookback_days: config.lookback_days,
            custom_tables: config.custom_tables || [],
          },
        },
        { responseType: "blob" }
      );

      const reportId = res.headers["x-report-id"];
      const contentDisposition = res.headers["content-disposition"] || "";
      const inferredName = contentDisposition.split("filename=")[1]?.replace(/"/g, "");
      const filename = inferredName || `fleetvision-${config.report_type}.${config.format}`;

      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            "Your report is ready and downloaded. You can preview it on the right, re-download from history, or start a new chat for another report.",
          suggestions: ["Start a new report", "Show fuel report", "Overall PDF for 30 days"],
        },
      ]);
      toast.success("Report generated and downloaded");
      await fetchHistory();
      if (reportId) await openPreview(reportId);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: "I couldn't generate the report just now. Please try again, or rephrase your requirements.",
          suggestions: ["Try again with PDF", "Fuel report for 30 days"],
        },
      ]);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const sendMessage = async (text?: string) => {
    const question = (text || input).trim();
    if (!question || loading || generating) return;

    if (/^start a new report$/i.test(question)) {
      resetChat();
      return;
    }

    setInput("");
    const userMsg: ChatMessage = { id: uid(), role: "user", content: question };
    const nextHistory = [...messages, userMsg]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.post<ApiResponse<ChatTurn>>("/reports/chat", {
        message: question,
        history: nextHistory,
        state: chatState,
      });
      const turn = res.data.data;
      if (!turn) throw new Error("empty");

      setChatState(turn.state || {});
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: turn.reply,
        suggestions: turn.ready
          ? undefined
          : quickSuggestionsForState(turn.state || {}),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (turn.ready && turn.config) {
        await runGenerate(turn.config);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: "Sorry — I hit a snag processing that. You can try again or pick one of the suggestions below.",
          suggestions: ["Overall fleet report", "Fuel cost analysis", "Driver performance"],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopNav title="Smart Reports" subtitle="Chat with AI to design and generate fleet reports" />
      <div className="p-6 lg:p-8 h-[calc(100vh-64px)] flex flex-col gap-5">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 flex-1 min-h-0">
          {/* Chat column */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="xl:col-span-3 flex flex-col min-h-0 glass-card rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Report Studio Chat</p>
                  <p className="text-xs text-[var(--muted)]">AI asks requirements → then generates PDF/JSON/CSV</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={resetChat}>
                <RotateCcw className="h-3.5 w-3.5" /> New chat
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "var(--violet-soft)", color: "var(--violet)" }}
                      >
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div className="max-w-[85%] space-y-2">
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user" ? "text-white" : "bg-[var(--muted-bg)] text-[var(--foreground)]"
                        }`}
                        style={msg.role === "user" ? { background: "var(--primary)" } : undefined}
                      >
                        {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
                      </div>
                      {!!msg.suggestions?.length && (
                        <div className="flex flex-wrap gap-2">
                          {msg.suggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => sendMessage(s)}
                              disabled={loading || generating}
                              className="text-xs rounded-full border border-[var(--border)] px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] transition-all disabled:opacity-50"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted-bg)]">
                        <User className="h-4 w-4 text-[var(--muted)]" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {(loading || generating) && (
                <div className="flex gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "var(--violet-soft)", color: "var(--violet)" }}
                  >
                    <Bot className="h-4 w-4 animate-pulse" />
                  </div>
                  <div className="bg-[var(--muted-bg)] rounded-2xl px-4 py-3 text-sm text-[var(--muted)]">
                    {generating ? "Building report with analytics & charts…" : "Thinking…"}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-[var(--border)] p-4">
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="e.g. I need a fuel report for the last 30 days as PDF…"
                  className="flex-1"
                  disabled={loading || generating}
                />
                <Button onClick={() => sendMessage()} disabled={loading || generating || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {!!Object.keys(chatState).length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(chatState).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[10px] uppercase tracking-wide rounded-full px-2.5 py-1 bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]"
                    >
                      {k.replaceAll("_", " ")}: {Array.isArray(v) ? v.join(", ") : String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Side panel: history + preview */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="xl:col-span-2 flex flex-col gap-4 min-h-0"
          >
            <Card className="shrink-0">
              <CardHeader className="mb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" /> Recent reports
                </CardTitle>
                <CardDescription>Re-download or preview previous generations</CardDescription>
              </CardHeader>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {history.slice(0, 6).map((h) => (
                  <div key={h.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium capitalize">{h.report_type}</p>
                      <span className="text-[10px] text-[var(--muted)]">{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openPreview(h.id)}>
                        Preview
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => redownload(h.id, "pdf")}>
                        <Download className="h-3 w-3" /> PDF
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => redownload(h.id, "json")}>
                        JSON
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => redownload(h.id, "csv")}>
                        CSV
                      </Button>
                    </div>
                  </div>
                ))}
                {!history.length && (
                  <p className="text-xs text-[var(--muted)] text-center py-4">No reports yet — chat to generate one.</p>
                )}
              </div>
            </Card>

            <Card className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <CardHeader className="mb-3 shrink-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" /> Preview
                </CardTitle>
                <CardDescription>LLM summary, analytics, and charts</CardDescription>
              </CardHeader>
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {selectedReport ? (
                  <>
                    <div className="rounded-xl border border-[var(--border)] p-3">
                      <p className="text-xs whitespace-pre-wrap leading-relaxed text-[var(--muted)]">
                        {selectedReport.llm_summary}
                      </p>
                    </div>
                    {selectedReport.payload.analytics && (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(selectedReport.payload.analytics).slice(0, 6).map(([k, v]) => (
                          <div key={k} className="rounded-xl bg-[var(--muted-bg)] p-3">
                            <p className="text-[10px] text-[var(--muted)] uppercase">{k.replaceAll("_", " ")}</p>
                            <p className="text-lg font-bold">{String(v)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {!!selectedReport.payload.charts &&
                      Object.entries(selectedReport.payload.charts).map(([name, rows]) => (
                        <div key={name} className="rounded-xl border border-[var(--border)] p-3">
                          <p className="text-xs font-semibold mb-2 flex items-center gap-2">
                            <BarChart3 className="h-3.5 w-3.5 text-[var(--primary)]" />
                            {name.replaceAll("_", " ")}
                          </p>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={rows}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey={Object.keys(rows[0] || {})[0]} hide />
                                <YAxis width={28} />
                                <Tooltip />
                                <Bar dataKey={Object.keys(rows[0] || {})[1]} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ))}
                  </>
                ) : (
                  <p className="text-sm text-[var(--muted)] text-center py-12">
                    Chat with the assistant to generate a report — preview appears here.
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  );
}

function quickSuggestionsForState(state: Record<string, unknown>): string[] {
  if (!state.report_type) {
    return ["Overall fleet report", "Vehicle inventory", "Fuel analysis", "Custom report"];
  }
  if (!state.format) {
    return ["PDF", "JSON", "CSV"];
  }
  if (!state.lookback_days) {
    return ["7 days", "30 days", "90 days"];
  }
  if (!state.sections) {
    return ["All sections", "analytics and charts", "tables and history"];
  }
  if (state.report_type === "custom" && !state.custom_tables) {
    return ["All tables", "vehicles and trips", "fuel and expenses"];
  }
  return ["Looks good — generate it"];
}
