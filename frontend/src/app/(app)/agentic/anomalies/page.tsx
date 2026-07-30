"use client";

import { AgenticCanvas } from "@/components/agentic/agentic-canvas";

export default function AgenticAnomaliesPage() {
  return (
    <AgenticCanvas
      domain="anomalies"
      title="Anomaly Desk Agent"
      subtitle="Misuse · idle · unassigned · underuse detection"
    />
  );
}
