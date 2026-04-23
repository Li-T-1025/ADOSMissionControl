"use client";
import { useAgentSystemStore } from "@/stores/agent-system-store";

export function ServiceHealthWidget() {
  const services = useAgentSystemStore((s) => s.services);
  const list = Object.entries(services ?? {}).slice(0, 8);
  return (
    <div className="p-3 h-full flex flex-col">
      <span className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Services</span>
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {list.length === 0 && <div className="text-xs text-text-tertiary">Not connected</div>}
        {list.map(([name, svc]) => (
          <div key={name} className="flex items-center gap-2 text-xs">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(svc as any)?.state === "running" ? "bg-status-success" : "bg-status-error"}`} />
            <span className="text-text-secondary truncate">{name.replace("ados-", "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
