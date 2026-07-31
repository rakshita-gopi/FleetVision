"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Panel,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Bot,
  Check,
  Cpu,
  Download,
  Loader2,
  Play,
  Settings2,
  Sparkles,
  User,
  Wrench,
  X,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import api, { ApiResponse } from "@/lib/api";
import { ActionProposal } from "@/types";
import { toast } from "sonner";
import { useAgenticMode } from "@/contexts/agentic-mode-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface ParamField {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "multiselect" | "toggle" | "slider";
  options?: string[];
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  domain: string;
  capabilities: string[];
  color: string;
  params_schema?: ParamField[];
  default_params?: Record<string, unknown>;
}

export interface WorkerDef {
  id: string;
  name: string;
  kind: string;
  description: string;
  params_schema?: ParamField[];
  default_params?: Record<string, unknown>;
}

type FlowNodeData = { title: string; subtitle?: string; color?: string };
type FlowNode = Node<FlowNodeData>;

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

interface FlowGraph {
  agent_id: string;
  default_prompt: string;
  default_workers: string[];
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: FlowNodeData;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    color?: string;
  }[];
}

interface RunResult {
  session_id: string;
  answer: string;
  proposals: ActionProposal[];
  events: { type: string; tool?: string; worker_id?: string; summary?: string; ok?: boolean }[];
  agent: AgentDef;
}

function ParamForm({
  schema,
  values,
  onChange,
}: {
  schema: ParamField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  if (!schema.length) return <p className="text-xs text-[var(--muted)]">No parameters.</p>;
  const set = (name: string, v: unknown) => onChange({ ...values, [name]: v });
  return (
    <div className="space-y-3">
      {schema.map((f) => {
        const val = values[f.name] ?? f.default;
        return (
          <div key={f.name}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{f.label}</label>
              {f.type === "toggle" && (
                <button
                  type="button"
                  onClick={() => set(f.name, !val)}
                  className={cn("h-5 w-9 rounded-full relative", val ? "bg-[var(--primary)]" : "bg-[var(--border)]")}
                >
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow", val ? "left-4" : "left-0.5")} />
                </button>
              )}
            </div>
            {f.type === "text" && (
              <input className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs" value={String(val ?? "")} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
            )}
            {f.type === "number" && (
              <input type="number" min={f.min} max={f.max} className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs" value={Number(val ?? 0)} onChange={(e) => set(f.name, Number(e.target.value))} />
            )}
            {f.type === "slider" && (
              <div>
                <input type="range" min={f.min} max={f.max} step={f.step || 0.05} value={Number(val ?? 0)} onChange={(e) => set(f.name, Number(e.target.value))} className="w-full accent-[var(--primary)]" />
                <p className="text-[10px] text-right text-[var(--muted)]">{Number(val).toFixed(2)}</p>
              </div>
            )}
            {f.type === "select" && (
              <select className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs" value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)}>
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
            {f.type === "multiselect" && (
              <div className="flex flex-wrap gap-1.5">
                {(f.options || []).map((o) => {
                  const arr = Array.isArray(val) ? (val as string[]) : [];
                  const on = arr.includes(o);
                  return (
                    <button key={o} type="button" onClick={() => set(f.name, on ? arr.filter((x) => x !== o) : [...arr, o])} className={cn("text-[10px] px-2 py-1 rounded-full border", on ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] text-[var(--muted)]")}>
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CardShell({ children, selected, accent, icon: Icon, title, handles }: { children: React.ReactNode; selected?: boolean; accent?: string; icon: typeof Bot; title: string; handles?: { left?: number; right?: number } }) {
  return (
    <div className={cn("rounded-2xl border bg-[var(--card)] shadow-lg min-w-[230px] max-w-[290px]", selected ? "ring-2 ring-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]")} style={{ borderTopWidth: accent ? 3 : 1, borderTopColor: accent || undefined }}>
      {Array.from({ length: handles?.left || 0 }).map((_, i) => (
        <Handle key={`L${i}`} id={`in-${i}`} type="target" position={Position.Left} style={{ top: `${28 + i * 28}%`, background: accent || "#a855f7", width: 10, height: 10 }} />
      ))}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)] bg-[var(--muted-bg)]/50 rounded-t-2xl">
        <Icon className="h-4 w-4 text-[var(--muted)]" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="p-3 text-xs">{children}</div>
      {Array.from({ length: handles?.right || 0 }).map((_, i) => (
        <Handle key={`R${i}`} id={`out-${i}`} type="source" position={Position.Right} style={{ top: `${40 + i * 20}%`, background: accent || "#ec4899", width: 10, height: 10 }} />
      ))}
    </div>
  );
}

function UserFlowNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return <CardShell selected={selected} icon={User} title={d.title} accent="#c084fc" handles={{ right: 1 }}><p className="text-[var(--muted)] line-clamp-4">{d.subtitle}</p></CardShell>;
}
function ModelFlowNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return <CardShell selected={selected} icon={Cpu} title={d.title} accent="#a855f7" handles={{ right: 1 }}><p className="font-medium">Qwen3 · Ollama</p><p className="text-[var(--muted)] mt-1">{d.subtitle}</p></CardShell>;
}
function ToolsFlowNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return <CardShell selected={selected} icon={Wrench} title={d.title} accent="#818cf8" handles={{ left: 1, right: 1 }}><p className="text-[var(--muted)]">{d.subtitle}</p></CardShell>;
}
function AgentFlowNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return <CardShell selected={selected} icon={Bot} title={d.title} accent={d.color || "#ca8a04"} handles={{ left: 3, right: 1 }}><p className="text-[var(--muted)] line-clamp-3">{d.subtitle}</p></CardShell>;
}
function WorkerFlowNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return <CardShell selected={selected} icon={Sparkles} title={d.title} accent="#ec4899" handles={{ left: 1 }}><p className="text-[var(--muted)] whitespace-pre-wrap line-clamp-8">{d.subtitle || "Awaiting run…"}</p></CardShell>;
}

const nodeTypes = { userNode: UserFlowNode, modelNode: ModelFlowNode, toolsNode: ToolsFlowNode, agentNode: AgentFlowNode, workerNode: WorkerFlowNode };

export function AgenticCanvas({ domain, title, subtitle }: { domain: string; title: string; subtitle: string }) {
  const { agenticMode, setAgenticMode } = useAgenticMode();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [workers, setWorkers] = useState<WorkerDef[]>([]);
  const [flow, setFlow] = useState<FlowGraph | null>(null);
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(800);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [agentParams, setAgentParams] = useState<Record<string, Record<string, unknown>>>({});
  const [workerParams, setWorkerParams] = useState<Record<string, Record<string, unknown>>>({});
  const [enabledWorkers, setEnabledWorkers] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState("");
  const [showOutput, setShowOutput] = useState(false);
  const [outputFailed, setOutputFailed] = useState(false);
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("agent");
  const [statusLabel, setStatusLabel] = useState("Idle");
  const [loadError, setLoadError] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const agentMeta = useMemo(() => agents.find((a) => a.id === selectedAgentId), [agents, selectedAgentId]);
  const domainAgents = useMemo(() => {
    const f = agents.filter((a) => a.domain === domain || a.id === selectedAgentId);
    return f.length ? f : agents;
  }, [agents, domain, selectedAgentId]);

  useEffect(() => {
    if (!agenticMode) setAgenticMode(true);
  }, [agenticMode, setAgenticMode]);

  useEffect(() => {
    setLoadError("");
    setAnswer("");
    setShowOutput(false);
    setSessionId(null);
    setStatusLabel("Idle");
    api
      .get<ApiResponse<{ agents: AgentDef[]; workers: WorkerDef[]; flow: FlowGraph }>>(`/agentic/catalog/?domain=${domain}`, { timeout: 30000 })
      .then((res) => {
        const data = res.data.data;
        if (!data) throw new Error("empty catalog");
        const ag = data.agents || [];
        const wk = data.workers || [];
        const fl = data.flow;
        setAgents(ag);
        setWorkers(wk);
        setFlow(fl);
        const agentId = fl?.agent_id || ag.find((a) => a.domain === domain)?.id || ag[0]?.id || "";
        setSelectedAgentId(agentId);
        setPrompt(fl?.default_prompt || "");
        const defaults: Record<string, Record<string, unknown>> = {};
        ag.forEach((a) => { defaults[a.id] = { ...(a.default_params || {}) }; });
        setAgentParams(defaults);
        const wdef: Record<string, Record<string, unknown>> = {};
        wk.forEach((w) => { wdef[w.id] = { ...(w.default_params || {}) }; });
        setWorkerParams(wdef);
        const linked = (fl?.default_workers || []).filter((id) => wk.some((w) => w.id === id));
        setEnabledWorkers(linked.length ? linked : wk.slice(0, 3).map((w) => w.id));

        if (fl) {
          setNodes(
            fl.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: { ...n.data, color: ag.find((a) => a.id === agentId)?.color },
            }))
          );
          setEdges(
            fl.edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
              animated: false,
              style: { stroke: e.color || "#a855f7", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: e.color || "#a855f7" },
            }))
          );
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || "Failed to load agent catalog";
        setLoadError(msg);
        toast.error(msg);
      });

    api.get<ApiResponse<ActionProposal[]>>("/agentic/proposals/?status=pending").then((res) => {
      setProposals(res.data.data || []);
    });
  }, [domain, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === "user") return { ...n, data: { ...n.data, subtitle: prompt } };
        if (n.id === "model") return { ...n, data: { ...n.data, subtitle: `temp ${temperature.toFixed(2)} · ${maxTokens} tokens` } };
        if (n.id === "agent") return { ...n, data: { ...n.data, title: agentMeta?.name || n.data.title, subtitle: agentMeta?.role || n.data.subtitle, color: agentMeta?.color } };
        if (n.id === "worker") return { ...n, data: { ...n.data, subtitle: answer || (running ? "Responding…" : "Awaiting run…") } };
        return n;
      })
    );
  }, [prompt, temperature, maxTokens, agentMeta, answer, running, setNodes]);

  useEffect(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, animated: running })));
  }, [running, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, style: { stroke: "#a855f7", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#a855f7" } }, eds)),
    [setEdges]
  );

  const runFlow = async () => {
    if (!prompt.trim() || running) return;
    if (!selectedAgentId) {
      toast.error("No agent selected — catalog may have failed to load");
      return;
    }
    setRunning(true);
    setStatusLabel("Running…");
    setAnswer("");
    setShowOutput(false);
    setOutputFailed(false);
    try {
      const res = await api.post<ApiResponse<RunResult>>(
        "/agentic/run/",
        {
          message: prompt,
          session_id: isUuid(sessionId) ? sessionId : undefined,
          agent_id: selectedAgentId,
          config: {
            temperature,
            max_tokens: maxTokens,
            agent: agentParams[selectedAgentId] || {},
            workers: Object.fromEntries(enabledWorkers.map((id) => [id, workerParams[id] || {}])),
            enabled_workers: enabledWorkers,
          },
        },
        { timeout: 120000 }
      );
      const data = res.data.data;
      if (!res.data.success || !data) {
        throw new Error(res.data.message || "Empty agent response");
      }
      if (data.session_id && isUuid(data.session_id)) setSessionId(data.session_id);
      const text = (data as RunResult & { report?: string }).report || data.answer || "Run complete — no additional notes.";
      setAnswer(text);
      setOutputFailed(false);
      setShowOutput(true);
      if (data.proposals?.length) {
        setProposals((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...data.proposals.filter((p) => !ids.has(p.id)), ...prev];
        });
      }
      setStatusLabel("Complete");
      toast.success("Flow complete");
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { message?: string } }; message?: string; code?: string };
      const msg =
        ax.response?.data?.message ||
        (ax.code === "ECONNABORTED" ? "Timed out — try a shorter prompt or Dispatch/Alerts agent" : null) ||
        ax.message ||
        "Agent run failed";
      setAnswer(msg);
      setOutputFailed(true);
      setShowOutput(true);
      setStatusLabel("Failed");
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const decide = async (id: string, action: "approve" | "reject") => {
    try {
      await api.post(`/agentic/proposals/${id}/${action}/`);
      toast.success(action === "approve" ? "Approved & executed" : "Rejected");
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error(`Failed to ${action}`);
    }
  };

  const saveOutput = () => {
    const blob = new Blob([answer || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rental-iq-${domain}-agent-output.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Output saved");
  };

  const flowStyle = { width: "100%", height: "100%" } satisfies CSSProperties;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xl px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-[var(--muted)]">{subtitle}</p>
          {loadError && <p className="text-xs text-[var(--danger)] mt-1">{loadError}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)] px-2 py-1 rounded-full bg-[var(--muted-bg)]">{statusLabel}</span>
          <Button onClick={runFlow} disabled={running || !selectedAgentId}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running…" : "Run flow"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAgenticMode(false); router.push("/dashboard"); }}>
            Exit agentic
          </Button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-88px)]">
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <ReactFlow
              style={flowStyle}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid
              snapGrid={[16, 16]}
              onNodeClick={(_, n) => setSelectedNodeId(n.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--border)" />
              <Controls />
              <MiniMap pannable zoomable nodeColor="#fef9c3" maskColor="rgba(253, 250, 240, 0.7)" />
              <Panel position="top-left" className="text-[11px] text-[var(--muted)] bg-[var(--card)]/90 border border-[var(--border)] rounded-lg px-3 py-2">
                {flow ? `${flow.nodes.length} nodes · ${enabledWorkers.length} workers` : "Loading graph…"}
              </Panel>
            </ReactFlow>
          </ReactFlowProvider>

          {proposals.length > 0 && (
            <div className="absolute right-4 bottom-4 w-[300px] rounded-2xl border border-amber-300 bg-[var(--card)] shadow-xl p-3 space-y-2 z-20">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-medium"><Radio className="h-3.5 w-3.5" /> HITL · {proposals.length}</div>
              {proposals.slice(0, 3).map((p) => (
                <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--muted-bg)] p-2.5 space-y-2">
                  <p className="text-[11px] leading-snug">{p.rationale}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-7 text-[11px]" onClick={() => decide(p.id, "approve")}><Check className="h-3 w-3" /> Approve</Button>
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={() => decide(p.id, "reject")}><X className="h-3 w-3" /> Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="w-[320px] shrink-0 border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Inspector</p>
            <h2 className="text-sm font-semibold mt-1 flex items-center gap-2"><Settings2 className="h-4 w-4 text-[var(--primary)]" />{selectedNodeId || "Select a node"}</h2>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Prompt</p>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-2 text-xs" />
          </div>

          <div className="rounded-xl border border-[var(--border)] p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Model</p>
            <div>
              <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1"><span>Temperature</span><span>{temperature.toFixed(2)}</span></div>
              <input type="range" min={0} max={1} step={0.05} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1"><span>Max tokens</span><span>{maxTokens}</span></div>
              <input type="range" min={200} max={2000} step={50} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Agent role</p>
            <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-2 text-xs">
              {domainAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {agentMeta && (
              <>
                <p className="text-[11px] text-[var(--muted)]">{agentMeta.role}</p>
                <ParamForm schema={agentMeta.params_schema || []} values={agentParams[selectedAgentId] || {}} onChange={(next) => setAgentParams((p) => ({ ...p, [selectedAgentId]: next }))} />
              </>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Workers ({enabledWorkers.length})</p>
            {workers.map((w) => {
              const on = enabledWorkers.includes(w.id);
              return (
                <div key={w.id} className="rounded-lg border border-[var(--border)] p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div><p className="text-xs font-medium">{w.name}</p><p className="text-[10px] text-[var(--muted)]">{w.kind}</p></div>
                    <button type="button" onClick={() => setEnabledWorkers((prev) => (on ? prev.filter((x) => x !== w.id) : [...prev, w.id]))} className={cn("h-5 w-9 rounded-full relative shrink-0", on ? "bg-[var(--primary)]" : "bg-[var(--border)]")}>
                      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white", on ? "left-4" : "left-0.5")} />
                    </button>
                  </div>
                </div>
              );
            })}
            {!workers.length && <p className="text-xs text-[var(--muted)]">Workers will appear after catalog loads.</p>}
          </div>

          <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Last output</p>
            {answer ? (
              <button
                type="button"
                onClick={() => setShowOutput(true)}
                className="w-full text-left text-xs leading-relaxed text-[var(--foreground)] hover:text-[var(--primary)] line-clamp-4"
              >
                {answer}
              </button>
            ) : (
              <p className="text-xs text-[var(--muted)]">Run the flow to see results in a dialog.</p>
            )}
          </div>
        </aside>
      </div>

      {showOutput && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-output-title"
          onClick={() => setShowOutput(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Agent output</p>
                <h2 id="agent-output-title" className="text-lg font-semibold mt-0.5">
                  {agentMeta?.name || title}
                </h2>
                <p className={cn("text-xs mt-1", outputFailed ? "text-red-600" : "text-emerald-700")}>
                  {outputFailed ? "Run failed" : "Run complete"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowOutput(false)}
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--muted-bg)] hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[min(60vh,420px)] overflow-y-auto">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)]">
                {answer || "No output."}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--muted-bg)]/40">
              <Button variant="outline" size="sm" onClick={saveOutput} disabled={!answer}>
                <Download className="h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" onClick={() => setShowOutput(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
