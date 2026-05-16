"use client";

/**
 * @module RegistryPluginGrid
 * @description Inline registry catalog rendered on the per-drone Plugins
 * tab below the installed list. Surfaces every published first-party
 * plugin via Convex `pluginRegistry.listPlugins`, applies client-side
 * search + category filtering, and on Install click downloads the signed
 * archive, parses the manifest, and opens `<PluginInstallDialog>`
 * directly at the `summary` stage. Replaces the older modal "Browse the
 * registry" stage which is now removed.
 *
 * Already-installed plugins (read from `cmdPlugins:listForDevice`)
 * render with an Installed pill and a disabled Install button. The
 * compat hook gates Install on each card against the connected drone's
 * agent version + board.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useTranslations } from "next-intl";
import { Package, Search } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { useAuthStore } from "@/stores/auth-store";
import { isDemoMode, cn } from "@/lib/utils";
import type { FleetDrone } from "@/lib/types";

import {
  PluginInstallDialog,
  type InstallTargetDrone,
  type InstallManifestSummary,
} from "@/components/plugins/PluginInstallDialog";
import {
  extractManifestYaml,
  parseManifestYaml,
  toInstallSummary,
} from "@/components/plugins/transports/manifest-parse";

import {
  RegistryPluginCard,
  type RegistryPluginRow,
} from "./RegistryPluginCard";

type RegistryCategory = "drivers" | "ui" | "ai" | "telemetry" | "tools";
type CategoryFilter = "all" | RegistryCategory;

const CATEGORIES: ReadonlyArray<RegistryCategory> = [
  "drivers",
  "ui",
  "ai",
  "telemetry",
  "tools",
];

interface ListPluginsResult {
  items: ReadonlyArray<RegistryPluginRow>;
  nextCursor: string | null;
  total: number;
}

/** Action return shape — see `convex/pluginRegistryDownload.ts`. */
interface DownloadArchiveResult {
  bytes_b64?: string;
  content_type?: string;
  url?: string;
}

const downloadArchiveRef = makeFunctionReference<
  "action",
  { plugin_id: string; version: string },
  DownloadArchiveResult
>("pluginRegistryDownload:downloadArchive");

/** Per-device install row shape (subset). Only needs `pluginId` so the
 * grid can mark installed plugins on their card. */
interface InstallRowForDevice {
  pluginId: string;
}

const listForDeviceRef = makeFunctionReference<
  "query",
  { deviceId: string },
  InstallRowForDevice[]
>("cmdPlugins:listForDevice");

type CardState = "loading" | { error: string } | undefined;

interface PendingInstall {
  manifest: InstallManifestSummary;
  manifestHash: string;
  file: File;
}

export interface RegistryPluginGridProps {
  drone: FleetDrone;
}

export function RegistryPluginGrid({ drone }: RegistryPluginGridProps) {
  const t = useTranslations("pluginRegistry.browse");
  const convexAvailable = useConvexAvailable();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const catalog = useQuery(
    api.pluginRegistry.listPlugins,
    convexAvailable && !isDemoMode() ? {} : "skip",
  ) as ListPluginsResult | undefined;

  // Already-installed plugin ids on this drone so we can mark cards.
  const installs = useConvexSkipQuery(listForDeviceRef, {
    args: { deviceId: drone.cloudDeviceId ?? drone.id },
    enabled: isAuthenticated && !isDemoMode(),
  });
  const installedIds = useMemo(() => {
    if (!installs) return new Set<string>();
    return new Set(installs.map((row) => row.pluginId));
  }, [installs]);

  const downloadArchive = useAction(downloadArchiveRef);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [cardState, setCardState] = useState<Record<string, CardState>>({});
  const [pending, setPending] = useState<PendingInstall | null>(null);

  const installTarget = useMemo<InstallTargetDrone>(
    () => ({
      _id: drone.cloudDeviceId ?? drone.id,
      deviceId: drone.cloudDeviceId ?? drone.id,
      name: drone.name ?? drone.id,
    }),
    [drone],
  );

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const needle = search.trim().toLowerCase();
    return catalog.items.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (needle) {
        const haystack = `${p.name} ${p.description}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [catalog, search, category]);

  const handleInstall = useCallback(
    async (plugin: RegistryPluginRow) => {
      const key = plugin.plugin_id;
      setCardState((prev) => ({ ...prev, [key]: "loading" }));
      try {
        const dl = await downloadArchive({
          plugin_id: plugin.plugin_id,
          version: plugin.latest_version,
        });

        let bytes: ArrayBuffer;
        if (dl.bytes_b64) {
          bytes = base64ToArrayBuffer(dl.bytes_b64);
        } else if (dl.url) {
          const resp = await fetch(dl.url);
          if (!resp.ok) {
            throw new Error(`Archive fetch failed: HTTP ${resp.status}`);
          }
          bytes = await resp.arrayBuffer();
        } else {
          throw new Error("Archive payload missing from action response");
        }

        const filename = `${plugin.plugin_id}-${plugin.latest_version}.adosplug`;
        const file = new File([bytes], filename, {
          type: dl.content_type ?? "application/zip",
        });

        const yaml = await extractManifestYaml(file);
        const parsed = parseManifestYaml(yaml);
        const hashBytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(yaml),
        );
        const manifestHash = Array.from(new Uint8Array(hashBytes))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const summary = toInstallSummary(parsed, manifestHash);

        setCardState((prev) => ({ ...prev, [key]: undefined }));
        setPending({ manifest: summary, manifestHash, file });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setCardState((prev) => ({ ...prev, [key]: { error: message } }));
      }
    },
    [downloadArchive],
  );

  if (!convexAvailable || isDemoMode()) {
    return (
      <section className="space-y-2">
        <SectionHeader t={t} />
        <ErrorMessage text={t("error.unavailable")} />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeader t={t} />
      <Toolbar
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        t={t}
      />

      {catalog === undefined && <SkeletonGrid />}

      {catalog !== undefined && filtered.length === 0 && <EmptyState t={t} />}

      {catalog !== undefined && filtered.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((plugin) => (
            <RegistryPluginCard
              key={plugin._id}
              plugin={plugin}
              installed={installedIds.has(plugin.plugin_id)}
              state={cardState[plugin.plugin_id]}
              onInstall={() => void handleInstall(plugin)}
            />
          ))}
        </ul>
      )}

      <PluginInstallDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        targetDevice={installTarget}
        initialStage="summary"
        initialManifest={pending?.manifest}
        initialManifestHash={pending?.manifestHash}
        initialFile={pending?.file}
      />
    </section>
  );
}

type T = ReturnType<typeof useTranslations>;

function SectionHeader({ t }: { t: T }) {
  return (
    <header className="space-y-0.5">
      <h3 className="text-base font-semibold text-text-primary">
        {t("title")}
      </h3>
      <p className="text-xs text-text-tertiary">{t("subtitle")}</p>
    </header>
  );
}

function Toolbar({
  search,
  setSearch,
  category,
  setCategory,
  t,
}: {
  search: string;
  setSearch: (v: string) => void;
  category: CategoryFilter;
  setCategory: (v: CategoryFilter) => void;
  t: T;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-md border border-border-default bg-bg-secondary py-1.5 pl-7 pr-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          aria-label={t("searchPlaceholder")}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
        <CategoryChip
          active={category === "all"}
          onClick={() => setCategory("all")}
          label={t("category.all")}
        />
        {CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            label={t(`category.${c}`)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
          : "border-border-default bg-bg-secondary text-text-secondary hover:border-border-strong",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({ t }: { t: T }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-default p-6 text-center">
      <Package className="h-6 w-6 text-text-tertiary" aria-hidden />
      <p className="text-sm text-text-primary">{t("empty.title")}</p>
      <p className="text-xs text-text-tertiary">{t("empty.subtitle")}</p>
    </div>
  );
}

function ErrorMessage({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
      {text}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="h-[120px] animate-pulse rounded-md border border-border-default bg-bg-secondary"
        />
      ))}
    </ul>
  );
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out.buffer;
}
