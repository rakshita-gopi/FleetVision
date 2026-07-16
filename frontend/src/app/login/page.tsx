"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Mail, Lock, ArrowRight, User, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { AnimatedBackground } from "@/components/ui/animated-background";
import api, { ApiResponse } from "@/lib/api";
import { toast } from "sonner";

function AuthForm() {
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("admin@fleetvision.ai");
  const [password, setPassword] = useState("admin123");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setMode("signup");
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome to FleetVision AI");
    } catch {
      toast.error("Invalid credentials. Try admin@fleetvision.ai / admin123");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/register", {
        name,
        email,
        password,
        phone,
        role: "Fleet Manager",
      });
      toast.success("Account created! Please sign in.");
      setMode("login");
    } catch {
      toast.error("Registration failed. Email may already exist.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg min-h-screen flex relative">
      <AnimatedBackground variant="auth" />

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12 border-r border-[var(--border)]">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-lg relative z-10"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
              <Truck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">FleetVision AI</h1>
              <p className="text-[var(--muted)] text-sm font-medium tracking-wide">Intelligent Fleet Management</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-[var(--foreground)] leading-tight mb-6">
            {mode === "login" ? "Welcome back to your command center" : "Start managing your fleet smarter"}
          </h2>
          <p className="text-[var(--muted)] text-lg leading-relaxed mb-8">
            Real-time GPS tracking, predictive maintenance, fuel analytics, and an AI assistant — powered by Ollama Qwen3.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Live Tracking", color: "var(--info)" },
              { label: "AI Insights", color: "var(--violet)" },
              { label: "Fleet Analytics", color: "var(--primary)" },
              { label: "Smart Reports", color: "var(--success)" },
            ].map((tag) => (
              <span
                key={tag.label}
                className="px-3 py-1.5 rounded-full text-xs font-medium border"
                style={{ background: `color-mix(in srgb, ${tag.color} 10%, transparent)`, color: tag.color, borderColor: `color-mix(in srgb, ${tag.color} 25%, transparent)` }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-3xl p-8 shadow-xl">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                <Truck className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">FleetVision AI</h1>
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-xl p-1 mb-8" style={{ background: "var(--muted-bg)" }}>
              {(["login", "signup"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMode(tab)}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200"
                  style={{
                    background: mode === tab ? "var(--card)" : "transparent",
                    color: mode === tab ? "var(--foreground)" : "var(--muted)",
                    boxShadow: mode === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {tab === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.div key="login" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                  <h2 className="text-2xl font-bold text-[var(--foreground)] mb-1">Welcome back</h2>
                  <p className="text-[var(--muted)] text-sm mb-6">Sign in to your fleet command center</p>
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading ? "Signing in..." : "Sign In"}
                      {!loading && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </form>
                  <p className="text-center text-xs text-[var(--muted)] mt-5">Demo: admin@fleetvision.ai / admin123</p>
                </motion.div>
              ) : (
                <motion.div key="signup" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                  <h2 className="text-2xl font-bold text-[var(--foreground)] mb-1">Create account</h2>
                  <p className="text-[var(--muted)] text-sm mb-6">Join FleetVision AI today</p>
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                        <Input value={name} onChange={(e) => setName(e.target.value)} className="pl-10" placeholder="John Doe" required />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-10" placeholder="+91 9876543210" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" minLength={6} required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading ? "Creating account..." : "Create Account"}
                      {!loading && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-center text-xs text-[var(--muted)] mt-6">
              <Link href="/" className="hover:text-[var(--primary)] transition-colors">← Back to home</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--muted)]">Loading...</div>}>
      <AuthForm />
    </Suspense>
  );
}
