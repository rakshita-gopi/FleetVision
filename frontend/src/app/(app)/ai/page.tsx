"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import api, { ApiResponse } from "@/lib/api";

const suggestions = [
  "Which vehicles require servicing?",
  "Show all active trips",
  "Summarize today's fleet operations",
  "Which vehicle has the highest fuel consumption?",
  "List vehicles under maintenance",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm your FleetVision AI assistant, powered by Ollama Qwen3:8B. Ask me anything about your fleet operations." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (text?: string) => {
    const question = text || input;
    if (!question.trim()) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await api.post<ApiResponse<{ answer: string }>>("/ai/chat", { question });
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.data?.answer || "No response" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that request. Ensure Ollama is running with qwen3:8b." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopNav title="AI Assistant" subtitle="Natural language fleet intelligence via Ollama" />
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-180px)]">
          <div className="lg:col-span-1 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Questions</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs text-[var(--muted)] hover:text-[var(--foreground)] bg-[var(--muted-bg)] hover:bg-[var(--hover)] rounded-lg px-3 py-2 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-white"
                      : "bg-[var(--muted-bg)] text-[var(--foreground)]"
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
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
                    <Bot className="h-4 w-4 animate-pulse" />
                  </div>
                  <div className="bg-[var(--muted-bg)] rounded-2xl px-4 py-3 text-sm text-[var(--muted)]">Analyzing fleet data...</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-[var(--border)] p-4 flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about your fleet..."
                className="flex-1"
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
