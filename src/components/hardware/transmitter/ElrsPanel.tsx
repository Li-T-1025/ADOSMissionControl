"use client";

/**
 * @module ElrsPanel
 * @description Three-column ELRS module configuration panel. Left column
 * is the device picker, middle column is the folder-tree parameter
 * browser, right column is the per-field editor widget. Hosts a Bind
 * Wizard slide-over and two shortcut actions that invoke the well-known
 * command fields (bind, WiFi update, commit).
 *
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  RefreshCw,
  Save,
  Zap,
  Wifi,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeElrsStore } from "@/stores/ados-edge-elrs-store";
import { ELRS_FIELD_TYPE, type ElrsField } from "@/lib/ados-edge/edge-link-elrs";
import { ElrsBindWizard } from "./ElrsBindWizard";

const FOLDER_ROOT = 255;

interface NumericBounds {
  min?: number;
  max?: number;
}

/** Parse bounds out of the firmware `options` string for numeric fields.
 * Firmware encodes bounds as `min:X,max:Y`. Either key is optional. */
function parseNumericBounds(options: string): NumericBounds {
  const bounds: NumericBounds = {};
  for (const part of options.split(",")) {
    const [key, value] = part.split(":").map((s) => s.trim());
    if (!key || !value) continue;
    const num = Number(value);
    if (!Number.isFinite(num)) continue;
    if (key === "min") bounds.min = num;
    else if (key === "max") bounds.max = num;
  }
  return bounds;
}

function splitEnumOptions(options: string): string[] {
  return options
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isFolder(field: ElrsField): boolean {
  return field.type === ELRS_FIELD_TYPE.FOLDER;
}

function isLeaf(field: ElrsField): boolean {
  return field.type !== ELRS_FIELD_TYPE.FOLDER;
}

function findCommandFieldByName(fields: ElrsField[], needle: string): ElrsField | null {
  const lower = needle.toLowerCase();
  return (
    fields.find(
      (f) =>
        f.type === ELRS_FIELD_TYPE.COMMAND && f.name.toLowerCase().includes(lower),
    ) ?? null
  );
}

export function ElrsPanel() {
  const link = useAdosEdgeStore((s) => s.link);
  const connected = useAdosEdgeStore((s) => s.state === "connected");

  const {
    devices,
    selectedAddr,
    tree,
    loading,
    error,
    pendingWrites,
    loadDevices,
    selectDevice,
    loadTree,
    setPendingValue,
    clearPending,
    commitField,
    runCommand,
    clear,
  } = useAdosEdgeElrsStore();

  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [filterText, setFilterText] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(
    () => new Set(),
  );
  const [bindOpen, setBindOpen] = useState(false);

  const noLinkError =
    error && error.toLowerCase().includes("unknown command")
      ? "No ELRS module detected"
      : error;

  useEffect(() => {
    if (connected && link) {
      loadDevices(link);
    }
    return () => {
      /* Do not clear on every render; only on unmount. */
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, link]);

  useEffect(() => {
    return () => {
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connected && link && selectedAddr !== null) {
      loadTree(link, selectedAddr);
      setSelectedFieldId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, link, selectedAddr]);

  const selectedField = useMemo(() => {
    if (selectedFieldId === null) return null;
    return tree.find((f) => f.id === selectedFieldId) ?? null;
  }, [selectedFieldId, tree]);

  const filteredTree = useMemo(() => {
    if (!filterText.trim()) return tree;
    const q = filterText.toLowerCase();
    /* Keep leaves that match by name; always keep their ancestor
     * folders so the match stays visible in the tree view. */
    const matchingLeafIds = new Set(
      tree
        .filter((f) => isLeaf(f) && f.name.toLowerCase().includes(q))
        .map((f) => f.id),
    );
    if (matchingLeafIds.size === 0) return [];
    const byId = new Map(tree.map((f) => [f.id, f]));
    const keep = new Set<number>();
    for (const id of matchingLeafIds) {
      let cursor: ElrsField | undefined = byId.get(id);
      while (cursor) {
        keep.add(cursor.id);
        if (cursor.parent === FOLDER_ROOT) break;
        cursor = byId.get(cursor.parent);
      }
    }
    return tree.filter((f) => keep.has(f.id));
  }, [tree, filterText]);

  const bindField = useMemo(
    () => findCommandFieldByName(tree, "bind"),
    [tree],
  );
  const wifiField = useMemo(
    () => findCommandFieldByName(tree, "wifi"),
    [tree],
  );
  const commitCommand = useMemo(
    () => findCommandFieldByName(tree, "commit"),
    [tree],
  );

  const toggleFolder = useCallback((id: number) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    if (!link) return;
    loadDevices(link);
    if (selectedAddr !== null) loadTree(link, selectedAddr);
  }, [link, loadDevices, loadTree, selectedAddr]);

  const handleSaveField = useCallback(
    (fieldId: number) => {
      if (!link) return;
      commitField(link, fieldId);
    },
    [link, commitField],
  );

  const handleRunCommand = useCallback(
    (fieldId: number) => {
      if (!link) return;
      runCommand(link, fieldId, "execute");
    },
    [link, runCommand],
  );

  const handleResetField = useCallback(
    (fieldId: number) => {
      clearPending(fieldId);
    },
    [clearPending],
  );

  return (
    <div className="flex flex-col gap-3 p-4 h-full">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            ELRS module
          </h2>
          <p className="text-xs text-text-tertiary">
            Configure the connected ELRS transmitter module.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bindField && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Radio size={14} />}
              onClick={() => setBindOpen(true)}
              disabled={!connected}
            >
              Bind
            </Button>
          )}
          {wifiField && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Wifi size={14} />}
              onClick={() => handleRunCommand(wifiField.id)}
              disabled={!connected || loading}
            >
              WiFi update
            </Button>
          )}
          {commitCommand && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Save size={14} />}
              onClick={() => handleRunCommand(commitCommand.id)}
              disabled={!connected || loading}
            >
              Commit
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw size={14} />}
            onClick={handleRefresh}
            disabled={!connected || loading}
          >
            Refresh
          </Button>
        </div>
      </header>

      {noLinkError && devices.length === 0 && (
        <div className="rounded border border-border-default bg-bg-secondary p-4 text-sm text-text-secondary">
          {noLinkError}
        </div>
      )}

      {!noLinkError || devices.length > 0 ? (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left: device picker */}
          <aside className="col-span-3 border border-border-default bg-bg-secondary rounded overflow-auto">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary border-b border-border-default">
              Devices
            </div>
            {devices.length === 0 ? (
              <div className="p-3 text-xs text-text-tertiary">
                No ELRS module detected
              </div>
            ) : (
              <ul className="flex flex-col">
                {devices.map((d) => {
                  const active = d.addr === selectedAddr;
                  return (
                    <li key={d.addr}>
                      <button
                        onClick={() => selectDevice(d.addr)}
                        className={`w-full text-left px-3 py-2 border-b border-border-default transition-colors ${
                          active
                            ? "bg-accent-primary/10 text-text-primary"
                            : "text-text-secondary hover:bg-bg-tertiary"
                        }`}
                      >
                        <div className="text-sm font-medium">{d.name}</div>
                        <div className="text-[10px] text-text-tertiary font-mono">
                          addr {d.addr} sw {d.sw_ver} fields {d.field_count}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Middle: parameter tree */}
          <section className="col-span-5 border border-border-default bg-bg-secondary rounded flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border-default flex items-center gap-2">
              <input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter fields"
                className="flex-1 h-7 text-xs bg-bg-primary border border-border-default px-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div className="flex-1 overflow-auto">
              {tree.length === 0 ? (
                <div className="p-3 text-xs text-text-tertiary">
                  {loading ? "Loading parameter tree" : "No fields loaded"}
                </div>
              ) : (
                <TreeView
                  fields={filteredTree}
                  collapsed={collapsedFolders}
                  toggleFolder={toggleFolder}
                  pendingWrites={pendingWrites}
                  selectedFieldId={selectedFieldId}
                  onSelectLeaf={setSelectedFieldId}
                />
              )}
            </div>
          </section>

          {/* Right: editor */}
          <section className="col-span-4 border border-border-default bg-bg-secondary rounded flex flex-col overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary border-b border-border-default">
              Editor
            </div>
            <div className="flex-1 overflow-auto p-3">
              {selectedField ? (
                <FieldEditor
                  field={selectedField}
                  draft={pendingWrites[selectedField.id]}
                  onChange={(v) => setPendingValue(selectedField.id, v)}
                  onReset={() => handleResetField(selectedField.id)}
                  onSave={() => handleSaveField(selectedField.id)}
                  onExecute={() => handleRunCommand(selectedField.id)}
                  busy={loading}
                />
              ) : (
                <div className="text-xs text-text-tertiary">
                  Select a field from the tree to edit it.
                </div>
              )}
            </div>
            {error && devices.length > 0 && (
              <div className="px-3 py-2 border-t border-border-default text-xs text-status-error">
                {error}
              </div>
            )}
          </section>
        </div>
      ) : null}

      <ElrsBindWizard
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        bindFieldId={bindField?.id ?? null}
        bindFieldName={bindField?.name ?? null}
      />
    </div>
  );
}

interface TreeViewProps {
  fields: ElrsField[];
  collapsed: Set<number>;
  toggleFolder: (id: number) => void;
  pendingWrites: Record<number, string>;
  selectedFieldId: number | null;
  onSelectLeaf: (id: number) => void;
}

function TreeView({
  fields,
  collapsed,
  toggleFolder,
  pendingWrites,
  selectedFieldId,
  onSelectLeaf,
}: TreeViewProps) {
  const byParent = useMemo(() => {
    const map = new Map<number, ElrsField[]>();
    for (const f of fields) {
      const arr = map.get(f.parent) ?? [];
      arr.push(f);
      map.set(f.parent, arr);
    }
    return map;
  }, [fields]);

  const renderNode = (node: ElrsField, depth: number): React.ReactNode => {
    const children = byParent.get(node.id) ?? [];
    const isSelected = node.id === selectedFieldId;
    const isModified =
      pendingWrites[node.id] !== undefined &&
      pendingWrites[node.id] !== node.value;

    if (isFolder(node)) {
      const isCollapsed = collapsed.has(node.id);
      return (
        <div key={node.id}>
          <button
            onClick={() => toggleFolder(node.id)}
            className="w-full flex items-center gap-1 px-2 py-1 text-left text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isCollapsed ? (
              <ChevronRight size={14} className="text-text-tertiary" />
            ) : (
              <ChevronDown size={14} className="text-text-tertiary" />
            )}
            <Folder size={14} className="text-text-tertiary" />
            <span className="font-medium">{node.name}</span>
          </button>
          {!isCollapsed && children.length > 0 && (
            <div>{children.map((c) => renderNode(c, depth + 1))}</div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.id}
        onClick={() => onSelectLeaf(node.id)}
        className={`w-full flex items-center justify-between gap-2 px-2 py-1 text-left text-xs transition-colors ${
          isSelected
            ? "bg-accent-primary/10 text-text-primary"
            : "text-text-secondary hover:bg-bg-tertiary"
        }`}
        style={{ paddingLeft: `${depth * 12 + 26}px` }}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {isModified && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-accent-primary shrink-0"
              aria-label="modified"
            />
          )}
          <span className="truncate">{node.name}</span>
        </span>
        <span className="font-mono text-[10px] text-text-tertiary shrink-0">
          {renderLeafValue(node)}
        </span>
      </button>
    );
  };

  const roots = byParent.get(FOLDER_ROOT) ?? [];
  if (roots.length === 0) {
    return (
      <div className="p-3 text-xs text-text-tertiary">No matches</div>
    );
  }
  return <div>{roots.map((r) => renderNode(r, 0))}</div>;
}

function renderLeafValue(field: ElrsField): string {
  if (field.type === ELRS_FIELD_TYPE.COMMAND) return "run";
  if (field.type === ELRS_FIELD_TYPE.INFO) return field.value || "-";
  const unit = field.units ? ` ${field.units}` : "";
  return `${field.value}${unit}`;
}

interface FieldEditorProps {
  field: ElrsField;
  draft: string | undefined;
  onChange: (v: string) => void;
  onReset: () => void;
  onSave: () => void;
  onExecute: () => void;
  busy: boolean;
}

function FieldEditor({
  field,
  draft,
  onChange,
  onReset,
  onSave,
  onExecute,
  busy,
}: FieldEditorProps) {
  const effective = draft ?? field.value;
  const dirty = draft !== undefined && draft !== field.value;

  const header = (
    <div className="flex flex-col gap-1 mb-3">
      <div className="text-sm font-semibold text-text-primary flex items-center gap-2">
        {field.name}
        {dirty && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-primary" />
        )}
      </div>
      <div className="text-[10px] font-mono text-text-tertiary">
        id {field.id} type {field.type}
        {field.units ? ` units ${field.units}` : ""}
      </div>
    </div>
  );

  if (field.type === ELRS_FIELD_TYPE.FOLDER) {
    return (
      <div>
        {header}
        <div className="text-xs text-text-tertiary">
          Folders group related fields. Select a leaf to edit.
        </div>
      </div>
    );
  }

  if (field.type === ELRS_FIELD_TYPE.COMMAND) {
    return (
      <div>
        {header}
        <p className="text-xs text-text-secondary mb-3">
          Run this command. Some commands require you to keep the radio
          powered while the firmware completes the action.
        </p>
        <Button
          icon={<Zap size={14} />}
          onClick={onExecute}
          disabled={busy}
        >
          Execute
        </Button>
      </div>
    );
  }

  if (field.type === ELRS_FIELD_TYPE.INFO) {
    return (
      <div>
        {header}
        <div className="text-sm font-mono text-text-primary bg-bg-primary border border-border-default px-3 py-2 rounded">
          {field.value || "-"}
        </div>
      </div>
    );
  }

  const footer = (
    <div className="flex items-center gap-2 mt-3">
      <Button onClick={onSave} disabled={!dirty || busy} icon={<Save size={14} />}>
        Save
      </Button>
      <Button variant="ghost" onClick={onReset} disabled={!dirty || busy}>
        Reset
      </Button>
      <span className="text-[10px] text-text-tertiary ml-auto font-mono">
        stored {field.value}
      </span>
    </div>
  );

  if (field.type === ELRS_FIELD_TYPE.ENUM) {
    const options = splitEnumOptions(field.options).map((label) => ({
      value: label,
      label,
    }));
    return (
      <div>
        {header}
        <Select
          options={options}
          value={effective}
          onChange={onChange}
          placeholder="Select a value"
          searchable={options.length > 10}
        />
        {footer}
      </div>
    );
  }

  if (field.type === ELRS_FIELD_TYPE.STRING) {
    return (
      <div>
        {header}
        <input
          value={effective}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-8 bg-bg-primary border border-border-default px-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        />
        {footer}
      </div>
    );
  }

  /* Numeric types 0 through 6. */
  const isFloat = field.type === ELRS_FIELD_TYPE.FLOAT;
  const bounds = parseNumericBounds(field.options);

  return (
    <div>
      {header}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={effective}
          step={isFloat ? "any" : 1}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-8 bg-bg-primary border border-border-default px-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        />
        {field.units && (
          <span className="text-xs text-text-tertiary">{field.units}</span>
        )}
      </div>
      {(bounds.min !== undefined || bounds.max !== undefined) && (
        <div className="mt-1 text-[10px] text-text-tertiary font-mono">
          range {bounds.min ?? "-"} to {bounds.max ?? "-"}
        </div>
      )}
      {footer}
    </div>
  );
}
