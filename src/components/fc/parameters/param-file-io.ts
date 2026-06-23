import type { ParameterValue } from "@/lib/protocol/types";
import {
  serializeParamFile,
  buildModifiedFromFile,
  parseParamFile,
  type SerializeParamOptions,
} from "@/lib/formats/param-file-parser";

export interface ExportParamFileOptions {
  format?: "mp" | "qgc";
  systemId?: number;
  componentId?: number;
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export parameters to a Mission Planner .param or QGC .params file (download). */
export function exportParamFile(
  parameters: ParameterValue[],
  modified: Map<string, number>,
  options: ExportParamFileOptions = {},
): void {
  const format = options.format ?? "mp";
  const rows = parameters.map((p) => ({
    name: p.name,
    value: modified.has(p.name) ? modified.get(p.name)! : p.value,
    type: p.type,
  }));
  const serializeOpts: SerializeParamOptions = {
    format,
    systemId: options.systemId,
    componentId: options.componentId,
  };
  const text = serializeParamFile(rows, serializeOpts);
  const ext = format === "qgc" ? "params" : "param";
  downloadText(`params_${dateStamp()}.${ext}`, text);
}

/**
 * Import parameters from a .param/.params file into the modified map.
 * @deprecated Prefer parseParamFile + buildModifiedFromFile at call sites when you need counts.
 */
export function importParamFile(
  text: string,
  parameters: ParameterValue[],
  modified: Map<string, number>,
): Map<string, number> {
  const fc = new Map<string, number>();
  for (const p of parameters) fc.set(p.name, p.value);
  return buildModifiedFromFile(parseParamFile(text), fc, modified).modified;
}
