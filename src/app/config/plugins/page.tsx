"use client";

import Link from "next/link";
import { useState } from "react";
import { Link2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PluginInstallDialog } from "@/components/plugins/PluginInstallDialog";
import { RiskBadge } from "@/components/plugins/RiskBadge";
import { communityApi } from "@/lib/community-api";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { usePairingStore } from "@/stores/pairing-store";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export default function PluginsIndexPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const installs = useConvexSkipQuery(communityApi.plugins.listMine, {
    enabled: isAuthenticated,
  });
  // The dialog is per-drone. Pick the currently-selected paired drone,
  // falling back to the first one. The legacy fleet-wide install page
  // becomes a thin redirect to whichever drone the operator was last
  // looking at; per-drone install lives on the drone detail panel.
  const pairedDrones = usePairingStore((s) => s.pairedDrones);
  const selectedPairedId = usePairingStore((s) => s.selectedPairedId);
  const targetDevice =
    pairedDrones.find((d) => d._id === selectedPairedId) ??
    pairedDrones[0] ??
    null;
  const [installOpen, setInstallOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlSubmitting, setUrlSubmitting] = useState(false);
  const { toast } = useToast();

  const openInstall = () => {
    if (!targetDevice) {
      toast(
        "Pair a drone before installing a plugin. Plugins are installed per drone.",
        "info",
      );
      return;
    }
    setInstallOpen(true);
  };

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
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Link2 className="h-4 w-4" />}
            onClick={() => setUrlOpen(true)}
          >
            Install from URL
          </Button>
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={openInstall}
          >
            Install plugin
          </Button>
        </div>
      </header>

      {installs === undefined ? (
        <p className="py-12 text-center text-sm text-text-tertiary">
          Loading...
        </p>
      ) : installs.length === 0 ? (
        <EmptyState onInstall={openInstall} />
      ) : (
        <ul className="divide-y divide-border-default rounded-md border border-border-default bg-bg-secondary">
          {installs.map((install) => (
            <li key={install._id}>
              <Link
                href={`/config/plugins/${install._id}`}
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

      {targetDevice && (
        <PluginInstallDialog
          open={installOpen}
          onClose={() => setInstallOpen(false)}
          targetDevice={targetDevice}
        />
      )}

      <Modal
        open={urlOpen}
        onClose={() => {
          if (!urlSubmitting) {
            setUrlOpen(false);
            setUrlValue("");
          }
        }}
        title="Install from URL"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setUrlOpen(false);
                setUrlValue("");
              }}
              disabled={urlSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const trimmed = urlValue.trim();
                if (!trimmed) return;
                setUrlSubmitting(true);
                try {
                  toast(
                    "URL install will route through the agent once the endpoint ships. Use local file install for now.",
                    "info",
                  );
                  setUrlOpen(false);
                  setUrlValue("");
                } finally {
                  setUrlSubmitting(false);
                }
              }}
              disabled={urlSubmitting || !urlValue.trim()}
            >
              {urlSubmitting ? "Submitting..." : "Install"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-text-tertiary">
            Paste a git or HTTPS URL to a signed{" "}
            <code className="rounded bg-bg-tertiary px-1">.adosplug</code>{" "}
            archive. The agent will fetch, verify the signature, and run
            the same install dialog you see for local files.
          </p>
          <Input
            label="Plugin URL"
            placeholder="https://example.com/com.example.thermal-1.0.0.adosplug"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
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
