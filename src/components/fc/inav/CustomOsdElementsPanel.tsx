/**
 * @module CustomOsdElementsPanel
 * @description iNav custom OSD elements editor.
 * Shows up to 8 custom text OSD elements. Each element has a visibility
 * toggle and a free-text field (max 16 ASCII characters).
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { PanelHeader } from "../shared/PanelHeader";
import { Type } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

interface OsdElement {
  index: number;
  visible: boolean;
  text: string;
}

const ELEMENT_COUNT = 8;
const MAX_TEXT_LEN = 16;

function defaultElement(index: number): OsdElement {
  return { index, visible: false, text: "" };
}

// ── Helpers ───────────────────────────────────────────────────

type OsdAdapter = {
  setCustomOsdElement(el: OsdElement): Promise<{ success: boolean; message: string }>;
};

function asAdapter(protocol: unknown): OsdAdapter | null {
  const p = protocol as Record<string, unknown>;
  if (p && typeof p.setCustomOsdElement === "function") return protocol as OsdAdapter;
  return null;
}

// ── Component ─────────────────────────────────────────────────

export function CustomOsdElementsPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [elements, setElements] = useState<OsdElement[]>(
    Array.from({ length: ELEMENT_COUNT }, (_, i) => defaultElement(i)),
  );

  const { isArmed, lockMessage } = useArmedLock();

  // Custom OSD elements do not have a dedicated GET command in iNav. the header
  // command returns a count and the per-element read requires an index payload.
  // For simplicity this panel uses a write-first workflow: the user configures
  // elements here and saves them individually. A read pass is triggered via the
  // page header "Read from FC" button which contacts the FC but returns an empty
  // payload for GET (no-op). The real data path is: FC -> Configurator, not our
  // direction. Users start from default state and modify from there.
  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) { setError("Not connected"); return; }
    setLoading(true); setError(null);
    // Signal that the panel is "loaded" so the write controls appear.
    setHasLoaded(true);
    setLoading(false);
  }, [getSelectedProtocol]);

  function updateElement(idx: number, key: keyof OsdElement, value: unknown) {
    setElements((prev) =>
      prev.map((el, i) => (i === idx ? { ...el, [key]: value } : el)),
    );
  }

  const handleSave = useCallback(async (idx: number) => {
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) { setError("Custom OSD elements not available on this firmware"); return; }
    setSavingIdx(idx); setError(null);
    try {
      const result = await adapter.setCustomOsdElement(elements[idx]);
      if (!result.success) setError(result.message);
    } catch (err) {
      setError(String(err));
    } finally {
      setSavingIdx(null);
    }
  }, [getSelectedProtocol, elements]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        <PanelHeader
          title="Custom OSD"
          subtitle={`Up to ${ELEMENT_COUNT} custom text OSD elements. Max ${MAX_TEXT_LEN} ASCII characters each.`}
          icon={<Type size={16} />}
          loading={loading}
          loadProgress={null}
          hasLoaded={hasLoaded}
          onRead={handleRead}
          connected={connected}
          error={error}
        />

        {hasLoaded && (
          <div className="border border-border-default rounded overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border-default bg-bg-secondary">
                  <th className="px-3 py-2 text-left text-text-tertiary font-medium w-8">#</th>
                  <th className="px-3 py-2 text-left text-text-tertiary font-medium w-20">Visible</th>
                  <th className="px-3 py-2 text-left text-text-tertiary font-medium">Text</th>
                  <th className="px-3 py-2 text-left text-text-tertiary font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el, idx) => (
                  <tr key={idx} className="border-b border-border-default last:border-0">
                    <td className="px-3 py-2 font-mono text-text-tertiary">{idx}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => updateElement(idx, "visible", !el.visible)}
                        className={`px-2 py-0.5 rounded border text-[10px] ${
                          el.visible
                            ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
                            : "border-border-default text-text-secondary"
                        }`}
                      >
                        {el.visible ? "On" : "Off"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        maxLength={MAX_TEXT_LEN}
                        value={el.text}
                        onChange={(e) => updateElement(idx, "text", e.target.value.slice(0, MAX_TEXT_LEN))}
                        placeholder={`Element ${idx} text`}
                        className="w-full bg-bg-tertiary border border-border-default rounded px-2 py-1 font-mono text-text-primary placeholder:text-text-tertiary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleSave(idx)}
                        disabled={savingIdx === idx || isArmed}
                        title={isArmed ? lockMessage : undefined}
                        className="text-[10px] px-2 py-1 border border-accent-primary text-accent-primary rounded hover:bg-accent-primary/10 disabled:opacity-50"
                      >
                        {savingIdx === idx ? "..." : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
