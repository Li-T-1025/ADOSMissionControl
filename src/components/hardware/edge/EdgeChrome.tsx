"use client";

/**
 * @module EdgeChrome
 * @description Persistent status strip rendered above every Edge route.
 * Slots left-to-right: product chip, connection LED + pill, device
 * identity triplet (board, MCU, firmware), active model label, warning
 * badges, three-dot quick-actions menu. Driven by the ados-edge-store
 * so it reflects session state without a per-route re-fetch.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeModelStore } from "@/stores/ados-edge-model-store";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SystemInfo } from "@/lib/ados-edge/edge-link";

const FACTORY_CONFIRM_PHRASE = "I-UNDERSTAND";

export function EdgeChrome() {
  const router = useRouter();
  const t = useTranslations("hardware.edge.chrome");

  const state = useAdosEdgeStore((s) => s.state);
  const firmware = useAdosEdgeStore((s) => s.firmware);
  const session = useAdosEdgeStore((s) => s.session);
  const link = useAdosEdgeStore((s) => s.link);
  const disconnect = useAdosEdgeStore((s) => s.disconnect);

  const models = useAdosEdgeModelStore((s) => s.models);
  const activeSlot = useAdosEdgeModelStore((s) => s.activeSlot);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemInfoSupported, setSystemInfoSupported] = useState<boolean | null>(null);
  const [factoryOpen, setFactoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [menuOpen]);

  /* Probe SYSTEM INFO on connect. Firmware v0.0.21+ implements it; older
   * builds return an error. Supported-flag governs factory-reset menu
   * availability. */
  useEffect(() => {
    if (state !== "connected" || !link) {
      setSystemInfo(null);
      setSystemInfoSupported(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await link.systemInfo();
        if (!cancelled) {
          setSystemInfo(info);
          setSystemInfoSupported(true);
        }
      } catch {
        if (!cancelled) {
          setSystemInfo(null);
          setSystemInfoSupported(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, link]);

  const activeModel =
    activeSlot !== null ? models.find((m) => m.i === activeSlot) : null;

  const connectionColor =
    state === "connected"
      ? "bg-status-success"
      : state === "connecting"
      ? "bg-accent-primary animate-pulse motion-reduce:animate-none"
      : state === "error"
      ? "bg-status-error"
      : "bg-text-tertiary";

  const stateLabel =
    state === "connected"
      ? session.status === "open" && session.stale
        ? t("stale")
        : t("connected")
      : state === "connecting"
      ? t("connecting")
      : state === "error"
      ? t("error")
      : t("disconnected");

  const onReboot = useCallback(async () => {
    setMenuOpen(false);
    if (!link) return;
    try {
      await link.reboot();
      setActivity(t("activity.reboot"));
    } catch (err) {
      setActivity(err instanceof Error ? err.message : String(err));
    } finally {
      window.setTimeout(() => setActivity(null), 3000);
    }
  }, [link, t]);

  const onDfu = useCallback(() => {
    setMenuOpen(false);
    router.push("/hardware/edge/firmware");
  }, [router]);

  const onLogs = useCallback(() => {
    setMenuOpen(false);
    router.push("/hardware/edge/logs");
  }, [router]);

  const onDisconnect = useCallback(() => {
    setMenuOpen(false);
    void disconnect();
  }, [disconnect]);

  const onFactoryReset = useCallback(() => {
    setMenuOpen(false);
    setFactoryOpen(true);
  }, []);

  const confirmFactoryReset = useCallback(async () => {
    setFactoryOpen(false);
    if (!link) return;
    try {
      await link.factoryReset(FACTORY_CONFIRM_PHRASE);
      setActivity(t("activity.factoryReset"));
    } catch (err) {
      setActivity(err instanceof Error ? err.message : String(err));
    } finally {
      window.setTimeout(() => setActivity(null), 4000);
    }
  }, [link, t]);

  /* Factory reset is gated on either the capability array (future
   * envelope builds) OR a successful systemInfo() probe (firmware
   * v0.0.21 ships factory.* even without the envelope). */
  const factoryCapable =
    link?.has("factory") || systemInfoSupported === true;
  const factoryDisabled = !factoryCapable;

  return (
    <div className="mb-3 flex flex-col gap-2 border-b border-border-default pb-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Slot 1: product chip */}
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          {t("product")}
        </span>

        {/* Slot 2: connection LED + state */}
        <span className="inline-flex items-center gap-2 rounded border border-border-default bg-bg-secondary px-2 py-0.5 text-[11px]">
          <span
            className={`inline-block h-2 w-2 rounded-full ${connectionColor}`}
            aria-hidden
          />
          <span className="text-text-secondary">{stateLabel}</span>
        </span>

        {/* Slot 3: device identity */}
        {firmware && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
            <span className="text-text-secondary">{firmware.board ?? t("unknownBoard")}</span>
            <span aria-hidden>•</span>
            <span>{firmware.mcu ?? t("unknownMcu")}</span>
            <span aria-hidden>•</span>
            <span className="font-mono text-text-primary">v{firmware.firmware}</span>
            {systemInfo && systemInfo.flashKb > 0 && (
              <>
                <span aria-hidden>•</span>
                <span className="tabular-nums">{systemInfo.flashKb} KB</span>
              </>
            )}
          </span>
        )}

        {/* Slot 4: active model */}
        {state === "connected" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
            <span className="text-text-secondary">{t("activeModel")}</span>
            <span className="text-text-primary">
              {activeModel ? activeModel.n : t("noActiveModel")}
            </span>
            {activeSlot !== null && (
              <sup className="ml-1 text-text-muted">[{activeSlot + 1}]</sup>
            )}
          </span>
        )}

        {/* Slot 5: warning badges */}
        {session.status === "open" && session.stale && (
          <Badge variant="warning">{t("warning.stale")}</Badge>
        )}
        {state === "connected" && link && link.session?.caps.length === 0 && (
          <Badge variant="warning">{t("warning.capsMissing")}</Badge>
        )}
        {systemInfo && systemInfo.resetReason !== "por" && systemInfo.resetReason !== "unknown" && (
          <Badge variant={resetBadgeVariant(systemInfo.resetReason)}>
            {t("resetReason.prefix")} {systemInfo.resetReason.toUpperCase()}
          </Badge>
        )}

        {/* spacer */}
        <div className="flex-1" />

        {/* Slot 6: quick actions menu */}
        {state === "connected" && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label={t("quickActions")}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border-default bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-9 z-20 flex min-w-[200px] flex-col rounded border border-border-default bg-bg-primary py-1 shadow-lg"
              >
                <MenuItem onClick={() => void onReboot()}>
                  {t("action.reboot")}
                </MenuItem>
                <MenuItem onClick={onDfu}>{t("action.dfu")}</MenuItem>
                <MenuItem onClick={onLogs}>{t("action.logs")}</MenuItem>
                <MenuItem
                  disabled={factoryDisabled}
                  onClick={factoryDisabled ? undefined : onFactoryReset}
                  title={factoryDisabled ? t("capMissing.factory") : undefined}
                >
                  {t("action.factoryReset")}
                </MenuItem>
                <MenuDivider />
                <MenuItem variant="danger" onClick={onDisconnect}>
                  {t("action.disconnect")}
                </MenuItem>
              </div>
            )}
          </div>
        )}
      </div>

      {activity && (
        <p className="text-[11px] text-text-muted" role="status">
          {activity}
        </p>
      )}

      <ConfirmDialog
        open={factoryOpen}
        onConfirm={() => void confirmFactoryReset()}
        onCancel={() => setFactoryOpen(false)}
        title={t("factory.title")}
        message={t("factory.body")}
        confirmLabel={t("factory.confirm")}
        variant="danger"
        typedPhrase={FACTORY_CONFIRM_PHRASE}
      />
    </div>
  );
}

/* ─────────────── sub-components ─────────────── */

function MenuItem({
  children,
  onClick,
  variant,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "danger";
  disabled?: boolean;
  title?: string;
}) {
  const color =
    variant === "danger" ? "text-status-error" : "text-text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-2 text-left text-xs ${color} hover:bg-bg-tertiary disabled:opacity-40 disabled:hover:bg-transparent`}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-border-default" />;
}

/* ─────────────── helpers ─────────────── */

function resetBadgeVariant(
  reason: string,
): "warning" | "error" | "info" {
  if (reason === "iwdg" || reason === "wwdg" || reason === "lpwr") return "error";
  if (reason === "soft" || reason === "bor") return "warning";
  return "info";
}
