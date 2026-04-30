"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PluginInstallDialog, type InstallManifestSummary } from "@/components/plugins/PluginInstallDialog";
import { RiskBadge } from "@/components/plugins/RiskBadge";
import { TrustBadge, type TrustSignal } from "@/components/plugins/TrustBadge";
import { communityApi } from "@/lib/community-api";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { cn } from "@/lib/utils";

export default function PluginsIndexPage() {
  const installs = useConvexSkipQuery(communityApi.plugins.listMine);
  const [installOpen, setInstallOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Plugins</h1>
          <p className="text-xs text-text-tertiary">
            Extensions installed on this Mission Control. Plugins run
            sandboxed and only do what their granted permissions allow.
          </p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setInstallOpen(true)}
        >
          Install plugin
        </Button>
      </header>

      {installs === undefined ? (
        <p className="py-12 text-center text-sm text-text-tertiary">
          Loading...
        </p>
      ) : installs.length === 0 ? (
        <EmptyState onInstall={() => setInstallOpen(true)} />
      ) : (
        <ul className="divide-y divide-border-default rounded-md border border-border-default bg-bg-secondary">
          {installs.map((install) => (
            <li key={install._id}>
              <Link
                href={`/settings/plugins/${install._id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-bg-tertiary"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">
                      {install.name}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      v{install.version}
                    </span>
                  </div>
                  <code className="block truncate text-xs text-text-tertiary">
                    {install.pluginId}
                  </code>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusPill status={install.status} />
                  <RiskBadge level={install.risk} size="sm" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <PluginInstallDialog
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        onParseArchive={parseArchiveStub}
        onApprove={() => Promise.reject(new Error("Wire to agent install endpoint"))}
      />
    </div>
  );
}

function EmptyState({ onInstall }: { onInstall: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-border-default p-8 text-center">
      <p className="text-sm text-text-primary">No plugins installed yet.</p>
      <p className="mt-1 text-xs text-text-tertiary">
        Drag a <code>.adosplug</code> file or pick one to install.
      </p>
      <Button
        variant="secondary"
        className="mt-4"
        icon={<Plus className="h-4 w-4" />}
        onClick={onInstall}
      >
        Install your first plugin
      </Button>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    installed: "border-text-secondary/30 bg-bg-tertiary text-text-tertiary",
    enabled: "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
    running:
      "border-status-success/40 bg-status-success/10 text-status-success",
    disabled: "border-text-secondary/30 bg-bg-tertiary text-text-tertiary",
    crashed: "border-status-error/40 bg-status-error/10 text-status-error",
    removed: "border-text-secondary/30 bg-bg-tertiary text-text-tertiary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        palette[status] ?? palette.disabled,
      )}
    >
      {status}
    </span>
  );
}

// Stub parser used until the agent install endpoint lands. Stage 2-Ext
// (Battery Health Panel) replaces this with a real archive reader plus
// a network call to the agent's `POST /api/plugins/install` endpoint.
async function parseArchiveStub(file: File): Promise<InstallManifestSummary> {
  void file;
  throw new Error(
    "Plugin install runs through the agent. Wire the agent endpoint before enabling install.",
  );
}

// keep TrustBadge imports referenced for build
export type { TrustSignal };
