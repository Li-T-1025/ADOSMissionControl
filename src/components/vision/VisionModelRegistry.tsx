"use client";

/**
 * @module VisionModelRegistry
 * @description Vision model registry + installed-model list for a single
 * drone. Calls the drone's own agent over the LAN
 * (`GET /api/vision/models`) to list the registry, the installed model
 * files, and the model-cache usage. Each registry model that is not yet
 * installed offers a Download action (`POST /api/vision/models/{id}/download`),
 * after which per-model progress is polled until the download settles.
 *
 * The agent picks the best variant for the board's NPU on download, so
 * the GCS only sends the model id.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  visionClientFromAgent,
  type VisionModelsResponse,
} from "@/lib/agent/vision-client";

const POLL_INTERVAL_MS = 1500;
const TERMINAL_STATES = new Set(["complete", "error", "idle"]);

interface DownloadState {
  state: string;
  percent: number;
}

export function VisionModelRegistry() {
  const t = useTranslations("vision");
  const { toast } = useToast();
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);

  const [data, setData] = useState<VisionModelsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const refresh = useCallback(async () => {
    const client = visionClientFromAgent(agentUrl, apiKey);
    if (!client) {
      setError(t("noAgent"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await client.listModels();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("listFailed"));
    } finally {
      setLoading(false);
    }
  }, [agentUrl, apiKey, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tear down any in-flight pollers on unmount.
  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      for (const id of Object.values(timers)) clearInterval(id);
    };
  }, []);

  const startDownload = useCallback(
    async (modelId: string) => {
      const client = visionClientFromAgent(agentUrl, apiKey);
      if (!client) {
        toast(t("noAgent"), "warning");
        return;
      }
      setDownloads((d) => ({
        ...d,
        [modelId]: { state: "downloading", percent: 0 },
      }));
      try {
        const result = await client.download(modelId);
        if (result.status === "error") {
          setDownloads((d) => ({
            ...d,
            [modelId]: { state: "error", percent: 0 },
          }));
          toast(result.message || t("downloadFailed"), "error");
          return;
        }
      } catch (err) {
        setDownloads((d) => ({
          ...d,
          [modelId]: { state: "error", percent: 0 },
        }));
        toast(
          err instanceof Error ? err.message : t("downloadFailed"),
          "error",
        );
        return;
      }

      // Poll progress until the download reaches a terminal state.
      if (pollTimers.current[modelId]) {
        clearInterval(pollTimers.current[modelId]);
      }
      pollTimers.current[modelId] = setInterval(async () => {
        const c = visionClientFromAgent(agentUrl, apiKey);
        if (!c) return;
        try {
          const status = await c.modelStatus(modelId);
          const dl = status.download;
          const state = status.installed
            ? "complete"
            : (dl?.state ?? "downloading");
          setDownloads((d) => ({
            ...d,
            [modelId]: { state, percent: dl?.percent ?? 0 },
          }));
          if (status.installed || TERMINAL_STATES.has(state)) {
            clearInterval(pollTimers.current[modelId]);
            delete pollTimers.current[modelId];
            if (status.installed || state === "complete") {
              toast(t("downloadComplete", { id: modelId }), "success");
              refresh();
            }
          }
        } catch {
          // Transient poll error — keep polling; the next tick may succeed.
        }
      }, POLL_INTERVAL_MS);
    },
    [agentUrl, apiKey, refresh, t, toast],
  );

  const installedIds = new Set((data?.installed ?? []).map((m) => m.id));

  return (
    <section className="rounded border border-border-default bg-bg-secondary p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("modelRegistry")}
        </h3>
        <div className="flex items-center gap-3">
          {data ? (
            <span className="font-mono text-[11px] text-text-tertiary">
              {t("cacheUsage", {
                used: data.cache.usedMb.toFixed(0),
                max: data.cache.maxMb.toFixed(0),
              })}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={13} />}
            onClick={refresh}
            disabled={loading}
          >
            {t("refresh")}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          <AlertTriangle size={13} />
          {error}
        </div>
      ) : null}

      {!error && data && data.registry.length === 0 ? (
        <p className="py-4 text-center text-xs text-text-tertiary">
          {t("emptyRegistry")}
        </p>
      ) : null}

      {!error && data ? (
        <ul className="flex flex-col gap-2">
          {data.registry.map((model) => {
            const installed = installedIds.has(model.id);
            const dl = downloads[model.id];
            const downloading =
              dl != null && !TERMINAL_STATES.has(dl.state);
            return (
              <li
                key={model.id}
                className="flex items-center gap-3 rounded border border-border-default bg-bg-tertiary px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-text-primary">
                      {model.name || model.id}
                    </span>
                    {model.task ? (
                      <span className="rounded border border-border-default px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-tertiary">
                        {model.task}
                      </span>
                    ) : null}
                  </div>
                  {model.description ? (
                    <p className="truncate text-[11px] text-text-tertiary">
                      {model.description}
                    </p>
                  ) : null}
                </div>

                {installed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-status-success">
                    <CheckCircle2 size={13} />
                    {t("installed")}
                  </span>
                ) : downloading ? (
                  <span className="font-mono text-[11px] text-accent-primary">
                    {dl.state === "verifying"
                      ? t("verifying")
                      : `${Math.round(dl.percent)}%`}
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Download size={13} />}
                    onClick={() => startDownload(model.id)}
                  >
                    {t("download")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
