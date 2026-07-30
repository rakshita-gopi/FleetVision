"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, Send, User, X } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api, { ApiResponse } from "@/lib/api";
import { ActionProposal } from "@/types";
import { toast } from "sonner";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";
import Magnet from "@/components/react-bits/Magnet";

const suggestions = [
  "Show overdue rentals and propose returns",
  "Summarise utilisation and idle assets",
  "Find excavators that need inspection",
  "Search equipment EQX0001",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AgenticPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Agentic Mode ready. I can search equipment, list overdue rentals, and propose actions (retain, return, reallocate, inspect, maintain, extend). You approve before anything runs.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    api.get<ApiResponse<ActionProposal[]>>("/agentic/proposals/?status=pending").then((res) => {
      setProposals(res.data.data || []);
    });
  }, []);

  const refreshProposals = () => {
    api.get<ApiResponse<ActionProposal[]>>("/agentic/proposals/?status=pending").then((res) => {
      setProposals(res.data.data || []);
    });
  };

  const sendMessage = async (text?: string) => {
    const question = text || input;
    if (!question.trim()) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await api.post<
        ApiResponse<{ answer: string; session_id: string; proposals: ActionProposal[] }>
      >("/agentic/chat/", { message: question, session_id: sessionId });
      const data = res.data.data;
      if (data?.session_id) setSessionId(data.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: data?.answer || "No response" }]);
      if (data?.proposals?.length) {
        setProposals((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...data.proposals.filter((p) => !ids.has(p.id)), ...prev];
        });
      }
      refreshProposals();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Could not reach agentic API. Is the backend running?" },
      ]);
    } finally {
      setLoading(false);
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

  return (
    <>
      <TopNav title="Agentic Mode" subtitle="Recommend → human approve → execute" />
      <div className="p-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold">
            <GradientText>Governed automation for the rental yard</GradientText>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Proposals stay pending until you approve — retain, return, reallocate, inspect, maintain, extend.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-220px)]">
          <div className="lg:col-span-1 space-y-3 overflow-y-auto">
            <SpotlightCard className="p-4" spotlightColor="rgba(212, 160, 23, 0.2)">
              <CardHeader className="p-0 mb-3">
                <CardTitle className="text-sm">Quick prompts</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <Magnet key={s}>
                    <button
                      onClick={() => sendMessage(s)}
                      className="w-full text-left text-xs text-[var(--muted)] hover:text-[var(--foreground)] bg-[var(--muted-bg)] hover:bg-[var(--hover)] rounded-lg px-3 py-2 transition-all"
                    >
                      {s}
                    </button>
                  </Magnet>
                ))}
              </div>
            </SpotlightCard>
            <SpotlightCard className="p-4" spotlightColor="rgba(220, 38, 38, 0.12)">
              <CardHeader className="p-0 mb-3">
                <CardTitle className="text-sm">Pending proposals</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {proposals.length === 0 && (
                  <p className="text-xs text-[var(--muted)]">No pending actions.</p>
                )}
                {proposals.map((p) => (
                  <div key={p.id} className="rounded-xl bg-[var(--muted-bg)] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge status={p.action_type} />
                      <span className="text-[10px] text-[var(--muted)]">{p.asset_id || p.rental_id}</span>
                    </div>
                    <p className="text-xs text-[var(--foreground)] leading-relaxed">{p.rationale}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => decide(p.id, "approve")}>
                        <Check className="h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => decide(p.id, "reject")}>
                        <X className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </div>

          <div className="lg:col-span-3 flex flex-col glass-card rounded-2xl overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user" ? "text-[#1c1917]" : "bg-[var(--muted-bg)] text-[var(--foreground)]"
                    }`}
                    style={msg.role === "user" ? { background: "var(--primary)" } : undefined}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted-bg)]">
                      <User className="h-4 w-4 text-[var(--muted)]" />
                    </div>
                  )}
                </motion.div>
              ))}
              {loading && (
                <div className="text-sm text-[var(--muted)] pl-11">Thinking with rental tools…</div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-[var(--border)] p-4 flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about overdue returns, utilisation, or an asset…"
              />
              <Button onClick={() => sendMessage()} disabled={loading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
