"use client";

import { useEffect, useState } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { Camera } from "lucide-react";

interface SurveyStatus {
  active: boolean;
  captured_frames: number;
  pass_frames: number;
  warn_frames: number;
  fail_frames: number;
  coverage_pct: number;
}

export function SurveyProgressWidget() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [status, setStatus] = useState<SurveyStatus | null>(null);

  useEffect(() => {
    if (!agentUrl) return;
    const poll = async () => {
      try {
        const headers: Record<string, string> = apiKey ? { "X-ADOS-Key": apiKey } : {};
        const resp = await fetch(`${agentUrl}/api/v1/survey/status`, { headers });
        if (resp.ok) setStatus(await resp.json());
      } catch {
        // silent
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [agentUrl, apiKey]);

  const total = status?.captured_frames ?? 0;
  const passPct = total > 0 ? Math.round(((status?.pass_frames ?? 0) / total) * 100) : 0;

  return (
    <div className="p-3 h-full flex flex-col justify-between">
      <div className="flex items-center gap-2">
        <Camera size={14} className="text-accent-primary" />
        <span className="text-xs text-text-tertiary uppercase tracking-wider">Survey</span>
      </div>
      {status?.active ? (
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums text-text-primary">{total}</span>
            <span className="text-xs text-text-tertiary">frames · {passPct}% pass</span>
          </div>
          <div className="text-xs text-text-tertiary">
            {status.pass_frames}P / {status.warn_frames}W / {status.fail_frames}F
          </div>
        </div>
      ) : (
        <div className="text-xs text-text-tertiary">No active survey</div>
      )}
    </div>
  );
}
