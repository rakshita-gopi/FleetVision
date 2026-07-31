"use client";

import { AgenticCanvas } from "@/components/agentic/agentic-canvas";

export default function AgenticDispatchPage() {
  return (
    <AgenticCanvas
      domain="dispatch"
      title="Dispatch Hub Agent"
      subtitle="Pending QR · active possessions · overdue / due returns · eligible assets"
    />
  );
}
