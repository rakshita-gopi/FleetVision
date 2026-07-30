"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  HardHat, MapPin, Bot, BarChart3, Shield, ArrowRight, Zap, ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedBackground } from "@/components/ui/animated-background";
import GradientText from "@/components/react-bits/GradientText";
import BlurText from "@/components/react-bits/BlurText";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import Magnet from "@/components/react-bits/Magnet";
import ShinyText from "@/components/react-bits/ShinyText";

const features = [
  { icon: MapPin, title: "Live Equipment Map", desc: "Track rented machinery in real time across sites", color: "var(--info)" },
  { icon: Bot, title: "Agentic Mode", desc: "Natural-language rental ops with human approval gates", color: "var(--primary)" },
  { icon: BarChart3, title: "Utilisation Insights", desc: "Spot idle assets, overdue returns, and demand gaps", color: "var(--warning)" },
  { icon: Shield, title: "Governed Automation", desc: "JWT + RBAC with approve/reject on high-impact actions", color: "var(--success)" },
];

const showcase = [
  {
    title: "Earthmoving",
    image: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Aerial access",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Material handling",
    image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=80",
  },
];

export default function LandingPage() {
  return (
    <div className="app-bg min-h-screen relative overflow-hidden">
      <AnimatedBackground variant="landing" />

      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            <HardHat className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-[var(--foreground)]">Rental-IQ</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Magnet>
            <Link href="/login?mode=signup">
              <Button size="sm">Get Started <ArrowRight className="h-3.5 w-3.5" /></Button>
            </Link>
          </Magnet>
        </div>
      </nav>

      <section className="relative z-10 px-6 lg:px-12 pt-10 pb-16 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6 border"
              style={{ background: "var(--primary-soft)", color: "var(--primary)", borderColor: "var(--primary)" }}
            >
              <Zap className="h-3.5 w-3.5" /> <ShinyText text="Smart rental equipment intelligence" className="text-xs" />
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--foreground)] leading-[1.05] tracking-tight mb-6">
              <span className="block mb-1">Rental-IQ</span>
              <GradientText className="text-[0.85em]">More when you need it most</GradientText>
            </h1>
            <p className="text-lg text-[var(--muted)] max-w-xl mb-8 leading-relaxed">
              <BlurText text="Unify live telemetry, check-in/out, utilisation, and Agentic Mode — so every excavator, lift, and telehandler earns its keep." />
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Magnet>
                <Link href="/login">
                  <Button size="lg" className="min-w-[180px]">
                    Open Manual Mode <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </Magnet>
              <Magnet>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="min-w-[180px]">
                    <ClipboardCheck className="h-4 w-4" /> Try Agentic Mode
                  </Button>
                </Link>
              </Magnet>
            </div>
            <p className="mt-6 text-xs text-[var(--muted)]">
              Visual language inspired by{" "}
              <a href="https://rent.cat.com/en_US" className="underline underline-offset-2" target="_blank" rel="noreferrer">
                Cat Rentals
              </a>
              . Motion patterns from{" "}
              <a href="https://reactbits.dev/" className="underline underline-offset-2" target="_blank" rel="noreferrer">
                React Bits
              </a>
              .
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="relative h-[360px] lg:h-[440px] rounded-3xl overflow-hidden border border-[var(--border)] shadow-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1400&q=80"
              alt="Construction equipment yard"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <p className="text-[#f5c518] text-xs uppercase tracking-widest font-semibold mb-1">Live yard</p>
              <p className="text-xl font-bold">Earthmoving · Aerial · Telehandlers</p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
          {showcase.map((s, i) => (
            <SpotlightCard key={s.title} className="overflow-hidden" spotlightColor="rgba(245, 197, 24, 0.25)">
              <div className="relative h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt={s.title} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <p className="absolute bottom-3 left-4 text-white font-semibold">{s.title}</p>
              </div>
            </SpotlightCard>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 text-left"
        >
          {features.map((f) => (
            <SpotlightCard key={f.title} className="p-5" spotlightColor="rgba(212, 160, 23, 0.2)">
              <f.icon className="h-6 w-6 mb-3" style={{ color: f.color }} />
              <h3 className="font-semibold text-[var(--foreground)] mb-1">{f.title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{f.desc}</p>
            </SpotlightCard>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
