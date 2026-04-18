"use client";

/**
 * @module ModelList
 * @description 16-slot model manager for the ADOS Edge transmitter.
 * Supports search, activate, inline rename, duplicate (auto-picks next
 * empty slot), export to YAML, import from file, and typed-phrase
 * confirmed delete. Drives the firmware through `ados-edge-model-store`.
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeModelStore } from "@/stores/ados-edge-model-store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ModelListEntry } from "@/lib/ados-edge/cdc-client";

const SLOT_COUNT = 16;

export function ModelList() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const models = useAdosEdgeModelStore((s) => s.models);
  const activeSlot = useAdosEdgeModelStore((s) => s.activeSlot);
  const loading = useAdosEdgeModelStore((s) => s.loading);
  const error = useAdosEdgeModelStore((s) => s.error);
  const busySlot = useAdosEdgeModelStore((s) => s.busySlot);

  const loadList = useAdosEdgeModelStore((s) => s.loadList);
  const setActive = useAdosEdgeModelStore((s) => s.setActive);
  const rename = useAdosEdgeModelStore((s) => s.rename);
  const remove = useAdosEdgeModelStore((s) => s.remove);
  const duplicate = useAdosEdgeModelStore((s) => s.duplicate);
  const exportSlot = useAdosEdgeModelStore((s) => s.exportSlot);
  const importSlot = useAdosEdgeModelStore((s) => s.importSlot);

  const [query, setQuery] = useState("");
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [menuOpenSlot, setMenuOpenSlot] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelListEntry | null>(null);
  const [activity, setActivity] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);
  const importTargetSlot = useRef<number | null>(null);

  useEffect(() => {
    if (connected) void loadList();
  }, [connected, loadList]);

  useEffect(() => {
    if (!menuOpenSlot) return;
    const handler = () => setMenuOpenSlot(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [menuOpenSlot]);

  const modelsByIndex = useMemo(
    () => new Map(models.map((m) => [m.i, m])),
    [models],
  );

  const lowerQuery = query.trim().toLowerCase();
  const matches = (model: ModelListEntry | undefined, slot: number): boolean => {
    if (lowerQuery.length === 0) return true;
    if (model && model.n.toLowerCase().includes(lowerQuery)) return true;
    if (`slot ${slot + 1}`.includes(lowerQuery)) return true;
    return false;
  };

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter first.
      </div>
    );
  }

  const startRename = (slot: number, currentName: string) => {
    setMenuOpenSlot(null);
    setEditingSlot(slot);
    setEditName(currentName);
  };

  const commitRename = async () => {
    if (editingSlot === null) return;
    const name = editName.trim();
    if (name.length === 0) {
      setEditingSlot(null);
      return;
    }
    await rename(editingSlot, name);
    setEditingSlot(null);
  };

  const onDuplicate = async (slot: number) => {
    setMenuOpenSlot(null);
    setActivity(`Duplicating slot ${slot + 1}...`);
    const dst = await duplicate(slot);
    setActivity(dst !== null ? `Copied to slot ${dst + 1}` : null);
    window.setTimeout(() => setActivity(null), 2500);
  };

  const onExport = async (slot: number, name: string) => {
    setMenuOpenSlot(null);
    try {
      setActivity(`Exporting slot ${slot + 1}...`);
      const yaml = await exportSlot(slot);
      const blob = new Blob([yaml], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = sanitizeFilename(`${name || `slot-${slot + 1}`}.yml`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setActivity(`Exported ${a.download}`);
    } catch (err) {
      setActivity(err instanceof Error ? err.message : String(err));
    } finally {
      window.setTimeout(() => setActivity(null), 2500);
    }
  };

  const onImportClick = (slot: number) => {
    setMenuOpenSlot(null);
    importTargetSlot.current = slot;
    importInputRef.current?.click();
  };

  const onImportHeaderClick = () => {
    const firstEmpty = findFirstEmptySlot(modelsByIndex);
    if (firstEmpty === null) {
      setActivity("No empty slots available. Delete a model first.");
      window.setTimeout(() => setActivity(null), 2500);
      return;
    }
    onImportClick(firstEmpty);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = importTargetSlot.current;
    e.target.value = "";
    if (!file || slot === null) return;
    try {
      setActivity(`Importing into slot ${slot + 1}...`);
      const yaml = await file.text();
      await importSlot(slot, yaml);
      setActivity(`Imported into slot ${slot + 1}`);
    } catch (err) {
      setActivity(err instanceof Error ? err.message : String(err));
    } finally {
      importTargetSlot.current = null;
      window.setTimeout(() => setActivity(null), 2500);
    }
  };

  const askDelete = (slot: number, entry: ModelListEntry) => {
    setMenuOpenSlot(null);
    setDeleteTarget(entry);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const slot = deleteTarget.i;
    setDeleteTarget(null);
    await remove(slot);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Models</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-9 w-48 rounded border border-border bg-surface-primary px-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
          <Button variant="ghost" onClick={onImportHeaderClick}>
            Import
          </Button>
          <Button variant="secondary" onClick={() => void loadList()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".yml,.yaml,text/yaml,application/x-yaml"
        onChange={onImportFile}
        className="hidden"
      />

      {error && <p className="text-sm text-status-error">{error}</p>}
      {activity && !error && (
        <p className="text-xs text-text-muted">{activity}</p>
      )}

      <div className="overflow-visible rounded-lg border border-border bg-surface-secondary">
        <table className="w-full text-sm">
          <thead className="bg-surface-primary text-xs uppercase text-text-muted">
            <tr>
              <th className="w-16 px-3 py-2 text-left">Slot</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="w-24 px-3 py-2 text-left">Active</th>
              <th className="w-[260px] px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SLOT_COUNT }).map((_, i) => {
              const model = modelsByIndex.get(i);
              if (!matches(model, i)) return null;
              const isActive = activeSlot === i;
              const rowBusy = busySlot === i;
              return (
                <tr key={i} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-3 py-2 text-text-muted tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 text-text-primary">
                    {editingSlot === i ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void commitRename();
                          if (e.key === "Escape") setEditingSlot(null);
                        }}
                        className="h-8 w-48 rounded border border-accent-primary bg-surface-primary px-2 text-sm text-text-primary focus:outline-none"
                      />
                    ) : model ? (
                      model.n
                    ) : (
                      <span className="text-text-muted">(empty)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {isActive ? (
                      <span className="text-accent-secondary">active</span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {model ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void setActive(i)}
                          disabled={isActive || rowBusy}
                        >
                          {isActive ? "Active" : "Activate"}
                        </Button>
                        <Link
                          href={`/hardware/edge/models/${i}`}
                          className="inline-flex h-8 items-center rounded border border-border px-3 text-xs text-text-primary hover:bg-surface-hover"
                        >
                          Open
                        </Link>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenSlot(menuOpenSlot === i ? null : i);
                            }}
                            disabled={rowBusy}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-hover disabled:opacity-50"
                            aria-label="More actions"
                          >
                            ⋯
                          </button>
                          {menuOpenSlot === i && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-9 z-10 flex min-w-[160px] flex-col rounded border border-border bg-surface-primary py-1 shadow-lg"
                            >
                              <MenuItem onClick={() => startRename(i, model.n)}>
                                Rename
                              </MenuItem>
                              <MenuItem onClick={() => void onDuplicate(i)}>
                                Duplicate
                              </MenuItem>
                              <MenuItem onClick={() => void onExport(i, model.n)}>
                                Export YAML
                              </MenuItem>
                              <MenuItem onClick={() => onImportClick(i)}>
                                Replace from file
                              </MenuItem>
                              <MenuDivider />
                              <MenuItem
                                variant="danger"
                                onClick={() => askDelete(i, model)}
                              >
                                Delete
                              </MenuItem>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onImportClick(i)}
                        >
                          Import here
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted">
        Rename commits on blur or Enter. Duplicate picks the next empty slot.
        Delete is permanent once confirmed; export first if you want a copy.
      </p>

      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        title="Delete model"
        message={
          deleteTarget
            ? `Slot ${deleteTarget.i + 1}: ${deleteTarget.n}. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        typedPhrase={deleteTarget ? `DELETE ${deleteTarget.n}` : undefined}
      />
    </div>
  );
}

/* ─────────────── sub-components ─────────────── */

function MenuItem({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "danger";
}) {
  const color =
    variant === "danger" ? "text-status-error" : "text-text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-left text-xs ${color} hover:bg-surface-hover`}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-border" />;
}

/* ─────────────── helpers ─────────────── */

function findFirstEmptySlot(byIndex: Map<number, ModelListEntry>): number | null {
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (!byIndex.has(i)) return i;
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
}
