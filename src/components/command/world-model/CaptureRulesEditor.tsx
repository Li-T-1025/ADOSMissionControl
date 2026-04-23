/**
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save, Play } from "lucide-react";

interface CaptureRulesEditorProps {
  apiBase: string;
  authHeaders: () => Record<string, string>;
}

const DEFAULT_RULES = `# Capture rules — first-match-wins.
# Persist detections matching these rules to the World Model.
- class: person
  min_confidence: 0.7
  tags: [human]
  notify: false

- class: vehicle
  min_confidence: 0.65
  full_res: false

- class: "*"
  min_confidence: 0.6
  persist: true
`;

export function CaptureRulesEditor({ apiBase, authHeaders }: CaptureRulesEditorProps) {
  const [yaml, setYaml] = useState(DEFAULT_RULES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/capture-rules`, { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        if (data.yaml) setYaml(data.yaml);
      }
    } catch {
      // service may not be running yet
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBase}/capture-rules`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ yaml }),
      });
      const data = await resp.json();
      if (data.errors?.length > 0) {
        setError(data.errors.join("\n"));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary text-xs">
        <span className="text-text-secondary">Capture rules YAML</span>
        <div className="flex-1" />
        <button onClick={load} disabled={loading} className="p-1 text-text-tertiary hover:text-text-primary">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/80 disabled:opacity-50 transition-colors"
        >
          <Save size={11} />
          {saved ? "Saved!" : saving ? "Saving…" : "Apply"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-status-error/10 border-b border-status-error/30 text-xs text-status-error">
          {error}
        </div>
      )}

      <textarea
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        className="flex-1 bg-surface-primary text-text-primary text-xs font-mono p-4 outline-none resize-none"
        spellCheck={false}
      />
    </div>
  );
}
