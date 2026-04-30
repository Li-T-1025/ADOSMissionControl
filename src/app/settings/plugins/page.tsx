"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useMutation } from "convex/react";

import { Button } from "@/components/ui/button";
import { PluginInstallDialog, type InstallManifestSummary } from "@/components/plugins/PluginInstallDialog";
import { RiskBadge } from "@/components/plugins/RiskBadge";
import { type TrustSignal } from "@/components/plugins/TrustBadge";
import { PluginAgentClient } from "@/lib/agent/plugin-client";
import { communityApi } from "@/lib/community-api";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { cn } from "@/lib/utils";

export default function PluginsIndexPage() {
  const installs = useConvexSkipQuery(communityApi.plugins.listMine);
  const recordInstall = useMutation(communityApi.plugins.recordInstall);
  const grantPermission = useMutation(communityApi.plugins.grantPermission);
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [installOpen, setInstallOpen] = useState(false);

  const agentClient = useMemo(
    () => (agentUrl ? new PluginAgentClient(agentUrl, apiKey ?? "") : null),
    [agentUrl, apiKey],
  );

  const parseArchive = useCallback(
    async (file: File): Promise<InstallManifestSummary> => {
      if (!agentClient) {
        throw new Error(
          "Agent not connected. Connect a drone before installing a plugin.",
        );
      }
      const summary = await agentClient.parseArchive(file);
      const trustSignals: TrustSignal[] = [];
      if (summary.signed) trustSignals.push("signed");
      if (
        summary.signer_id &&
        /^altnautica-\d{4}-[A-Z]$/.test(summary.signer_id)
      ) {
        trustSignals.push("verified-publisher");
      }
      if (!summary.signed) trustSignals.push("unsigned");
      return {
        pluginId: summary.plugin_id,
        version: summary.version,
        name: summary.name,
        description: summary.description,
        author: summary.author,
        license: summary.license,
        risk: summary.risk,
        halves: summary.halves,
        signerId: summary.signer_id ?? undefined,
        trustSignals,
        permissions: summary.permissions.map((p) => ({
          id: p.id,
          required: p.required,
        })),
      };
    },
    [agentClient],
  );

  const approveInstall = useCallback(
    async (
      file: File,
      manifest: InstallManifestSummary,
      grantedPermissions: ReadonlyArray<string>,
    ) => {
      if (!agentClient) {
        throw new Error("Agent not connected.");
      }
      // Commit the install on the agent now that the operator has
      // approved the manifest and selected which permissions to grant.
      await agentClient.install(file);
      // Mirror the install record into Convex (per-user state for the
      // GCS surface).
      const installId = await recordInstall({
        pluginId: manifest.pluginId,
        version: manifest.version,
        name: manifest.name,
        risk: manifest.risk,
        source: "local_file",
        signerId: manifest.signerId,
        manifestHash: "agent-managed",
        halves: manifest.halves,
        declaredPermissions: manifest.permissions.map((p) => ({
          id: p.id,
          required: p.required,
        })),
      });
      // Push grants to both the agent and Convex.
      for (const id of grantedPermissions) {
        await agentClient.grant(manifest.pluginId, id);
        await grantPermission({ installId, permissionId: id });
      }
    },
    [agentClient, recordInstall, grantPermission],
  );

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
        onParseArchive={parseArchive}
        onApprove={approveInstall}
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

