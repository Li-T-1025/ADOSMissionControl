/**
 * @module RegistryStage
 * @description Registry browse stage for the plugin install dialog. Lists
 * first-party plugins from the public registry, gates the per-card Install
 * action on per-drone compatibility, and on click pulls the signed
 * `.adosplug` from a server-side Convex action (GitHub Releases does not
 * serve CORS headers, so the bytes cannot be fetched directly from the
 * browser). The manifest is parsed client-side and handed back to the
 * parent dialog through `onSelect`, which transitions to the summary
 * stage and reuses the existing install pipeline.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useTranslations } from "next-intl";
import { ChevronLeft, Package, Search } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { RiskBadge } from "../RiskBadge";
import {
  extractManifestYaml,
  parseManifestYaml,
  type ParsedManifest,
} from "../transports/manifest-parse";
import { useRegistryCompatibility } from "./use-registry-compatibility";

type RegistryCategory = "drivers" | "ui" | "ai" | "telemetry" | "tools";
type CategoryFilter = "all" | RegistryCategory;

const CATEGORIES: ReadonlyArray<RegistryCategory> = [
  "drivers",
  "ui",
  "ai",
  "telemetry",
  "tools",
];

/** Plugin row returned by `pluginRegistry.listPlugins`. Local copy so
 * the component does not need the full Convex Doc type. */
interface RegistryPluginRow {
  _id: string;
  plugin_id: string;
  name: string;
  description: string;
  category: RegistryCategory;
  license: string;
  author_id: string;
  verified_publisher: boolean;
  latest_version: string;
  icon_url?: string;
  tier?: "first_party" | "verified" | "community";
}

interface ListPluginsResult {
  items: ReadonlyArray<RegistryPluginRow>;
  nextCursor: string | null;
  total: number;
}

/** Return shape of the Convex `downloadArchive` action. The action
 * either returns inline bytes (base64) or a signed Convex-storage URL
 * the browser can fetch (Convex storage serves CORS, GitHub Releases
 * does not). */
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

export interface RegistryStageProps {
  /** Target drone id. Reserved for future per-drone signals on the
   * registry call. */
  deviceId: string;
  onCancel: () => void;
  onBack: () => void;
  onSelect: (file: File, manifest: ParsedManifest) => void;
}

export function RegistryStage({
  deviceId: _deviceId,
  onCancel,
  onBack,
  onSelect,
}: RegistryStageProps) {
  const t = useTranslations("pluginRegistry.browse");
  const convexAvailable = useConvexAvailable();

  const result = useQuery(
    api.pluginRegistry.listPlugins,
    convexAvailable ? {} : "skip",
  ) as ListPluginsResult | undefined;

  const downloadArchive = useAction(downloadArchiveRef);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [cardState, setCardState] = useState<
    Record<string, "loading" | { error: string } | undefined>
  >({});

  const filtered = useMemo(() => {
    if (!result) return [];
    const needle = search.trim().toLowerCase();
    return result.items.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (needle) {
        const haystack = `${p.name} ${p.description}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [result, search, category]);

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
        const manifest = parseManifestYaml(yaml);

        setCardState((prev) => ({ ...prev, [key]: undefined }));
        onSelect(file, manifest);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setCardState((prev) => ({ ...prev, [key]: { error: message } }));
      }
    },
    [downloadArchive, onSelect],
  );

  if (!convexAvailable) {
    return (
      <StageFrame onCancel={onCancel} onBack={onBack} t={t}>
        <ErrorMessage text={t("error.unavailable")} />
      </StageFrame>
    );
  }

  return (
    <StageFrame onCancel={onCancel} onBack={onBack} t={t}>
      <Toolbar
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        t={t}
      />

      {result === undefined && <SkeletonGrid />}

      {result !== undefined && filtered.length === 0 && <EmptyState t={t} />}

      {result !== undefined && filtered.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((plugin) => (
            <RegistryCard
              key={plugin._id}
              plugin={plugin}
              state={cardState[plugin.plugin_id]}
              onInstall={() => void handleInstall(plugin)}
              t={t}
            />
          ))}
        </ul>
      )}
    </StageFrame>
  );
}

type T = ReturnType<typeof useTranslations>;

function StageFrame({
  children,
  onCancel,
  onBack,
  t,
}: {
  children: React.ReactNode;
  onCancel: () => void;
  onBack: () => void;
  t: T;
}) {
  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-text-primary">
          {t("title")}
        </h3>
        <p className="text-xs text-text-tertiary">{t("subtitle")}</p>
      </header>
      <div className="min-h-[280px]">{children}</div>
      <div className="flex justify-between gap-2 border-t border-border-default pt-3">
        <Button
          variant="ghost"
          icon={<ChevronLeft className="h-4 w-4" />}
          onClick={onBack}
        >
          {t("back")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
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

function RegistryCard({
  plugin,
  state,
  onInstall,
  t,
}: {
  plugin: RegistryPluginRow;
  state: "loading" | { error: string } | undefined;
  onInstall: () => void;
  t: T;
}) {
  // `listPlugins` returns the plugin row but not the per-version
  // compatibility envelope. `getPlugin` fills in `agent_min_version`
  // and `supported_boards`; Convex deduplicates the subscription
  // across cards that share an id.
  const detail = useQuery(api.pluginRegistry.getPlugin, {
    pluginId: plugin.plugin_id,
  }) as
    | {
        versions: ReadonlyArray<{
          version: string;
          agent_min_version: string;
          agent_max_version?: string;
          supported_boards?: ReadonlyArray<string>;
        }>;
      }
    | null
    | undefined;

  const latestVersionRow = useMemo(() => {
    if (!detail || detail === null) return null;
    return (
      detail.versions.find((v) => v.version === plugin.latest_version) ?? null
    );
  }, [detail, plugin.latest_version]);

  const compat = useRegistryCompatibility(
    latestVersionRow ?? {
      agent_min_version: plugin.latest_version,
      supported_boards: undefined,
    },
  );
  const isLoading = state === "loading";
  const errMessage =
    state && typeof state === "object" && "error" in state ? state.error : null;

  const disabled = !compat.compatible || isLoading || !latestVersionRow;
  const tooltip = (() => {
    if (!latestVersionRow) return undefined;
    if (!compat.compatible) {
      if (compat.reason === "version") {
        return t("card.notCompatible.version", {
          version: compat.detail ?? "?",
        });
      }
      if (compat.reason === "board") {
        return t("card.notCompatible.board");
      }
    }
    return undefined;
  })();

  const tierKey =
    plugin.tier ?? (plugin.verified_publisher ? "verified" : "community");

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border-default bg-bg-secondary p-3">
      <div className="flex items-start gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg-tertiary text-base font-semibold text-text-secondary">
          {plugin.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plugin.icon_url} alt="" className="h-10 w-10 rounded-md" />
          ) : (
            <Package className="h-5 w-5 text-text-tertiary" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="truncate text-sm font-medium text-text-primary">
              {plugin.name}
            </h4>
            <RiskBadge level="low" size="sm" />
          </div>
          <p className="line-clamp-2 text-xs text-text-tertiary">
            {plugin.description}
          </p>
          <div className="flex flex-wrap items-center gap-1 text-xs text-text-tertiary">
            <span className="truncate">{plugin.author_id}</span>
            <span aria-hidden>·</span>
            <span>v{plugin.latest_version}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="info" size="sm">
              {plugin.license}
            </Badge>
            <Badge
              variant={tierKey === "first_party" ? "success" : "info"}
              size="sm"
            >
              {t(`card.tierBadge.${tierKey}`)}
            </Badge>
          </div>
        </div>
      </div>

      {errMessage && (
        <p
          className="rounded border border-status-error/30 bg-status-error/10 px-2 py-1 text-[11px] text-status-error"
          role="alert"
        >
          {t("card.error", { error: errMessage })}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant={compat.compatible ? "primary" : "secondary"}
          disabled={disabled}
          onClick={onInstall}
          title={tooltip}
        >
          {isLoading ? t("card.installing") : t("card.install")}
        </Button>
      </div>
    </li>
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
