"use client";

/**
 * @module command/settings/ConfigFields
 * @description Reusable, agent-config-bound field primitives for the node
 * Settings tab. Each field reads its current value from the loaded config by
 * dot-path and writes back through the shared `setValue`. A Select / Toggle
 * writes immediately on change; a text field writes on Apply. A read-only row
 * shows a value the operator manages elsewhere (a transactional setup flow) so
 * the surface never ships a partial, inconsistent write.
 * @license GPL-3.0-only
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Select, type SelectOption } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { readConfigPath } from "./use-node-config";

interface BaseProps {
  configKey: string;
  label: string;
  hint?: string;
  config: Record<string, unknown> | null;
  readOnly: boolean;
  setValue: (key: string, value: string) => Promise<void>;
}

/** A Select bound to a string config key; writes on change. */
export function ConfigSelectField({
  configKey,
  label,
  hint,
  options,
  config,
  readOnly,
  setValue,
}: BaseProps & { options: SelectOption[] }) {
  const t = useTranslations("nodeSettings");
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const raw = readConfigPath(config, configKey);
  const current = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
  const value = pending ?? current;

  const onChange = async (next: string) => {
    if (readOnly || saving || next === value) return;
    setPending(next);
    setSaving(true);
    try {
      await setValue(configKey, next);
      toast(t("applied"), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t("applyFailed"), "error");
      setPending(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        label={label}
        options={options}
        value={value}
        onChange={(v) => void onChange(v)}
        disabled={readOnly || saving}
        placeholder={t("notSet")}
      />
      {hint ? <p className="text-[11px] text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

/** A Toggle bound to a boolean config key; writes on change. */
export function ConfigToggleField({
  configKey,
  label,
  hint,
  config,
  readOnly,
  setValue,
}: BaseProps) {
  const t = useTranslations("nodeSettings");
  const { toast } = useToast();
  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const raw = readConfigPath(config, configKey);
  const current = raw === true;
  const checked = pending ?? current;

  const onChange = async (next: boolean) => {
    if (readOnly || saving) return;
    setPending(next);
    setSaving(true);
    try {
      await setValue(configKey, next ? "true" : "false");
      toast(t("applied"), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t("applyFailed"), "error");
      setPending(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Toggle
        label={label}
        checked={checked}
        onChange={(v) => void onChange(v)}
        disabled={readOnly || saving}
      />
      {hint ? <p className="text-[11px] text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

/** A text field bound to a string config key; writes on Apply. Empty commits
 * an empty string (e.g. clearing a board override → auto-detect). */
export function ConfigTextField({
  configKey,
  label,
  hint,
  placeholder,
  config,
  readOnly,
  setValue,
}: BaseProps & { placeholder?: string }) {
  const t = useTranslations("nodeSettings");
  const { toast } = useToast();
  const raw = readConfigPath(config, configKey);
  const current = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const value = draft ?? current;
  const dirty = draft !== null && draft !== current;

  const onApply = async () => {
    if (readOnly || saving || !dirty) return;
    setSaving(true);
    try {
      await setValue(configKey, value.trim());
      toast(t("applied"), "success");
      setDraft(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : t("applyFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-secondary">{label}</label>
      <div className="flex items-end gap-2">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          disabled={readOnly || saving}
          className="h-9 flex-1 rounded border border-border-default bg-bg-tertiary px-2 font-mono text-sm text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onApply()}
          disabled={readOnly || saving || !dirty}
        >
          {saving ? t("saving") : t("apply")}
        </Button>
      </div>
      {hint ? <p className="text-[11px] text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

/** A labeled read-only value the operator manages in a transactional setup flow
 * (profile switch, cloud posture). Shows the real current value or "not set". */
export function ConfigReadonlyRow({
  configKey,
  label,
  hint,
  config,
  format,
}: {
  configKey: string;
  label: string;
  hint?: string;
  config: Record<string, unknown> | null;
  format?: (raw: unknown) => string | null;
}) {
  const t = useTranslations("nodeSettings");
  const raw = readConfigPath(config, configKey);
  const shown = format
    ? format(raw)
    : typeof raw === "string" && raw.length > 0
      ? raw
      : raw != null
        ? String(raw)
        : null;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-text-secondary">{label}</div>
        {hint ? (
          <p className="mt-0.5 text-[11px] text-text-tertiary">{hint}</p>
        ) : null}
      </div>
      <div className="shrink-0 font-mono text-sm text-text-primary">
        {shown ?? <span className="text-text-tertiary">{t("notSet")}</span>}
      </div>
    </div>
  );
}
