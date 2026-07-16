"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Truck, MapPin, Bot, BarChart3, Shield, ArrowRight, Zap, Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedBackground } from "@/components/ui/animated-background";

const features = [
  { icon: MapPin, title: "Live GPS Tracking", desc: "Monitor every vehicle in real time on interactive maps", color: "var(--info)" },
  { icon: Bot, title: "AI Fleet Assistant", desc: "Natural language insights powered by Ollama Qwen3", color: "var(--violet)" },
  { icon: BarChart3, title: "Smart Analytics", desc: "Fuel, maintenance, and expense analytics at a glance", color: "var(--primary)" },
  { icon: Shield, title: "Enterprise Security", desc: "Role-based access with JWT authentication", color: "var(--success)" },
];

const stats = [
  { value: "24/7", label: "Fleet Visibility" },
  { value: "AI", label: "Powered Insights" },
  { value: "100%", label: "Cloud Ready" },
];

export default function LandingPage() {
  return (
    <div className="app-bg min-h-screen relative overflow-hidden">
      <AnimatedBackground variant="landing" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            <Truck className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-[var(--foreground)]">FleetVision AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/login?mode=signup">
            <Button size="sm">Get Started <ArrowRight className="h-3.5 w-3.5" /></Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 lg:px-12 pt-16 pb-24 max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 border" style={{ background: "var(--primary-soft)", color: "var(--primary)", borderColor: "var(--primary)" }}>
            <Zap className="h-3.5 w-3.5" /> Intelligent Fleet Management Platform
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--foreground)] leading-tight tracking-tight mb-6">
            Your fleet,{" "}
            <span style={{ color: "var(--primary)" }}>fully visible</span>
            <br />and intelligently managed
          </h1>
          <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
            FleetVision AI brings together live tracking, predictive maintenance, fuel analytics, and an AI assistant — all in one refined platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login?mode=signup">
              <Button size="lg" className="min-w-[180px]">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="min-w-[180px]">Sign In</Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex justify-center gap-12 mt-20"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-[var(--foreground)]">{s.value}</p>
              <p className="text-xs text-[var(--muted)] mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 lg:px-12 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              className="glass-card rounded-2xl p-6 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4" style={{ background: `color-mix(in srgb, ${f.color} 12%, transparent)`, color: f.color }}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-[var(--foreground)] mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 lg:px-12 pb-20 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="glass-card rounded-3xl p-10"
        >
          <Route className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--primary)" }} />
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-3">Ready to transform your fleet operations?</h2>
          <p className="text-[var(--muted)] mb-6">Join FleetVision AI and take control of your entire fleet from one dashboard.</p>
          <Link href="/login?mode=signup">
            <Button size="lg">Create Account <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
