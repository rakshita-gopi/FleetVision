"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Check,
  ChevronRight,
  Cpu,
  Loader2,
  Radio,
  Send,
  Sparkles,
  User,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import api, { ApiResponse } from "@/lib/api";
import { ActionProposal } from "@/types";
import { toast } from "sonner";
import { useAgenticMode } from "@/contexts/agentic-mode-context";
import { useRouter } from "next/navigation";

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  domain: string;
  capabilities: string[];
  status: string;
  color: string;
}

export interface WorkerDef {
  id: string;
  name: string;
  kind: string;
  description: string;
  tools: string[];
}

interface AguiEvent {
  type: string;
  id: string;
  timestamp: string;
  agent_id?: string;
  worker_id?: string;
  tool?: string;
  content?: string;
  summary?: string;
  ok?: boolean;
  reason?: string;
  proposals?: ActionProposal[];
  delta?: Record<string, unknown>;
}

interface RunResult {
  run_id: string;
  agent: AgentDef;
  events: AguiEvent[];
  state: {
    active_agent?: string;
    active_workers?: string[];
    logs?: { worker: string; tool: string; ok: boolean; summary: string }[];
    interrupt?: { reason: string; proposals: ActionProposal[] } | null;
  };
  session_id: string;
  answer: string;
  proposals: ActionProposal[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  events?: AguiEvent[];
}

const DOMAIN_PROMPTS: Record<string, string[]> = {
  dashboard: [
    "Give me a fleet utilisation snapshot and propose reallocations",
    "What should I prioritise across agents right now?",
    "Find high-hour assets that need inspection",
  ],
  dispatch: [
    "List overdue returns that need dispatch follow-up",
    "Summarise open rentals ready for check-in",
    "Propose returns for overdue assets",
  ],
  demand: [
    "Run a 7-day demand forecast and highlight shortfalls",
    "Which sites need preposition of idle machines?",
    "Summarise demand hotspots",
  ],
  anomalies: [
    "Scan for misuse, long idle, and underuse anomalies",
    "Show unassigned active equipment risks",
    "What are the top anomaly scores?",
  ],
  alerts: [
    "Scan due-soon and overdue rental alerts",
    "Show overdue rentals and propose returns",
    "Escalate critical return notifications",
  ],
};

const AGENT_FOR_DOMAIN: Record<string, string> = {
  dashboard: "orchestrator",
  dispatch: "dispatch",
  demand: "demand",
  anomalies: "anomaly",
  alerts: "alert",
};

export function AgenticCanvas({
  domain = "dashboard",
  title,
  subtitle,
}: {
  domain?: string;
  title: string;
  subtitle: string;
}) {
  const { agenticMode, setAgenticMode } = useAgenticMode();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [workers, setWorkers] = useState<WorkerDef[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(AGENT_FOR_DOMAIN[domain] || "orchestrator");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Copilot-style agent desk ready (AG-UI events). Pick an agent, run a prompt, review tool traces, then approve HITL proposals.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<AguiEvent[]>([]);
  const [activeWorkers, setActiveWorkers] = useState<string[]>([]);
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agenticMode) setAgenticMode(true);
  }, [agenticMode, setAgenticMode]);

  useEffect(() => {
    api.get<ApiResponse<{ agents: AgentDef[]; workers: WorkerDef[] }>>("/agentic/catalog/").then((res) => {
      setAgents(res.data.data?.agents || []);
      setWorkers(res.data.data?.workers || []);
    });
    api.get<ApiResponse<ActionProposal[]>>("/agentic/proposals/?status=pending").then((res) => {
      setProposals(res.data.data || []);
    });
  }, []);

  useEffect(() => {
    setSelectedAgent(AGENT_FOR_DOMAIN[domain] || "orchestrator");
  }, [domain]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, events]);

  const domainAgents = useMemo(() => {
    if (domain === "dashboard") return agents;
    return agents.filter((a) => a.domain === domain || a.id === "orchestrator");
  }, [agents, domain]);

  const prompts = DOMAIN_PROMPTS[domain] || DOMAIN_PROMPTS.dashboard;

  const run = useCallback(
    async (text?: string) => {
      const question = (text || input).trim();
      if (!question) return;
      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setLoading(true);
      setEvents([]);
      try {
        const res = await api.post<ApiResponse<RunResult>>("/agentic/run/", {
          message: question,
          session_id: sessionId,
          agent_id: selectedAgent,
        });
        const data = res.data.data;
        if (!data) throw new Error("empty");
        if (data.session_id) setSessionId(data.session_id);
        setEvents(data.events || []);
        setActiveWorkers(data.state?.active_workers || []);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer || "No response",
            agentName: data.agent?.name,
            events: data.events,
          },
        ]);
        if (data.proposals?.length) {
          setProposals((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            return [...data.proposals.filter((p) => !ids.has(p.id)), ...prev];
          });
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Agent run failed — is the API up?" },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, sessionId, selectedAgent]
  );

  const decide = async (id: string, action: "approve" | "reject") => {
    try {
      await api.post(`/agentic/proposals/${id}/${action}/`);
      toast.success(action === "approve" ? "Approved & executed" : "Rejected");
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error(`Failed to ${action}`);
    }
  };

  const eventIcon = (t: string) => {
    if (t.includes("THINKING")) return <Cpu className="h-3 w-3" />;
    if (t.includes("TOOL")) return <Zap className="h-3 w-3" />;
    if (t.includes("INTERRUPT")) return <Radio className="h-3 w-3" />;
    if (t.includes("STATE")) return <Workflow className="h-3 w-3" />;
    return <ChevronRight className="h-3 w-3" />;
  };

  return (
    <div className="min-h-screen text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-800 bg-[#0c0a09]/90 backdrop-blur-xl px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-yellow-500/80 font-medium flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> AG-UI · Copilot canvas
          </p>
          <h1 className="text-xl font-semibold text-stone-50 mt-0.5">{title}</h1>
          <p className="text-sm text-stone-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-stone-700 text-stone-200 hover:bg-stone-800"
            onClick={() => {
              setAgenticMode(false);
              router.push("/dashboard");
            }}
          >
            Exit agentic
          </Button>
        </div>
      </header>

      <div className="p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[calc(100vh-88px)]">
        {/* Agents column */}
        <section className="xl:col-span-3 space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-stone-500 px-1">Agents</h2>
          <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
            {domainAgents.map((a) => {
              const active = selectedAgent === a.id;
              const busy = activeWorkers.length > 0 && a.id === selectedAgent && loading;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAgent(a.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition-all ${
                    active
                      ? "border-yellow-500/50 bg-yellow-400/10"
                      : "border-stone-800 bg-stone-900/60 hover:border-stone-600"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${a.color}22`, color: a.color }}
                    >
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-stone-100 truncate">{a.name}</p>
                        <span className="text-[10px] text-stone-500">{busy ? "running" : a.status}</span>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-2">{a.role}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {a.capabilities.slice(0, 3).map((c) => (
                          <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <h2 className="text-xs uppercase tracking-widest text-stone-500 px-1 pt-2">Workers</h2>
          <div className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
            {workers.map((w) => {
              const lit = activeWorkers.includes(w.id);
              return (
                <div
                  key={w.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    lit ? "border-teal-500/40 bg-teal-500/10" : "border-stone-800 bg-stone-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-stone-200">{w.name}</p>
                    <span className="text-[9px] uppercase tracking-wider text-stone-500">{w.kind}</span>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1 line-clamp-2">{w.description}</p>
                  {lit && (
                    <p className="text-[10px] text-teal-400 mt-1 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> active
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Copilot chat */}
        <section className="xl:col-span-6 flex flex-col rounded-2xl border border-stone-800 bg-stone-950/80 overflow-hidden min-h-[560px]">
          <div className="px-4 py-3 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium">Agent copilot</span>
            </div>
            <span className="text-[10px] text-stone-500">shared state · HITL · tool streaming</span>
          </div>

          <div className="px-3 py-2 border-b border-stone-800/80 flex flex-wrap gap-2 bg-stone-900/40">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => run(p)}
                className="text-[11px] px-2.5 py-1.5 rounded-full border border-stone-700 text-stone-300 hover:border-yellow-500/40 hover:text-yellow-200 transition-all"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-yellow-400/15 text-yellow-400 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-yellow-400 text-stone-900" : "bg-stone-900 text-stone-200 border border-stone-800"
                  }`}
                >
                  {msg.agentName && (
                    <p className="text-[10px] uppercase tracking-wider text-yellow-500/80 mb-1">{msg.agentName}</p>
                  )}
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-lg bg-stone-800 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-stone-400" />
                  </div>
                )}
              </motion.div>
            ))}
            {loading && (
              <p className="text-sm text-stone-500 pl-11 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Streaming AG-UI events…
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-stone-800 p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Steer the agent…"
              className="bg-stone-900 border-stone-700 text-stone-100"
            />
            <Button onClick={() => run()} disabled={loading} className="bg-yellow-400 text-stone-900 hover:bg-yellow-300">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Event timeline + HITL */}
        <section className="xl:col-span-3 space-y-3">
          <div className="rounded-2xl border border-stone-800 bg-stone-950/80 p-3 max-h-[48vh] overflow-y-auto">
            <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-3">AG-UI event stream</h2>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {events.map((ev) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-lg border border-stone-800 bg-stone-900/50 px-2.5 py-2"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-400">
                      {eventIcon(ev.type)}
                      <span className="text-yellow-500/90">{ev.type}</span>
                    </div>
                    <p className="text-[11px] text-stone-300 mt-1 leading-snug">
                      {ev.content || ev.summary || ev.reason || ev.tool || ev.worker_id || "—"}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {events.length === 0 && (
                <p className="text-xs text-stone-600 py-8 text-center">Run an agent to see events</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-950/80 p-3 space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-stone-500">Human-in-the-loop</h2>
            {proposals.length === 0 && <p className="text-xs text-stone-600">No pending proposals</p>}
            {proposals.map((p) => (
              <div key={p.id} className="rounded-xl bg-stone-900 border border-stone-800 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge status={p.action_type} />
                  <span className="text-[10px] text-stone-500">{p.asset_id || p.rental_id}</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">{p.rationale}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-500" onClick={() => decide(p.id, "approve")}>
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-stone-700"
                    onClick={() => decide(p.id, "reject")}
                  >
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
