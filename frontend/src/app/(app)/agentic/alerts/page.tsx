"use client";

import { AgenticCanvas } from "@/components/agentic/agentic-canvas";

export default function AgenticAlertsPage() {
  return (
    <AgenticCanvas
      domain="alerts"
      title="Alerts & Notifications Agent"
      subtitle="Due-soon · due-today · overdue scan and notify"
    />
  );
}
