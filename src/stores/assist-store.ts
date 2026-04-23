/**
 * @module AssistStore
 * @description Zustand store for Assist: diagnostics, suggestions,
 * repair queue, PR drafts, fleet patterns, and wizard state.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export interface AssistDiagnosticSnapshot {
  id: string;
  capturedAt: string;
  triggerKind: "rule" | "operator" | "emergency" | "crash_loop";
  ruleId: string | null;
  confidence: number;
  contextWindowMinutes: number;
  evidencePath: string | null;
}

export interface AssistSuggestion {
  id: string;
  ruleId: string;
  summary: string;
  confidence: number;
  safetyClass: "read" | "safe_write" | "flight_action" | "destructive";
  proposedRepairIds: string[];
  proposedPrIntentIds: string[];
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export interface AssistRepairItem {
  id: string;
  proposedAt: string;
  origin: string;
  action: string;
  args: Record<string, unknown>;
  safetyClass: string;
  state: "pending_confirm" | "applied" | "rolled_back" | "rejected";
  appliedAt: string | null;
  rolledBackAt: string | null;
  rollbackToken: string | null;
}

export interface AssistPrDraft {
  id: string;
  createdAt: string;
  repo: "ADOSDroneAgent" | "ADOSMissionControl";
  title: string;
  description: string;
  diffPreview: string;
  suggestedCommitMessage: string;
  state: "draft" | "pushed" | "merged" | "closed";
}

export interface AssistFleetPattern {
  id: string;
  patternType: string;
  summary: string;
  affectedDrones: string[];
  affectedFlights: number;
  firstSeenAt: string;
  suggestedFixSummary: string | null;
}

export interface AssistFeatureToggles {
  diagnostics: boolean;
  suggestions: boolean;
  selfHealing: boolean;
  prDrafts: boolean;
  fleetPatterns: boolean;
  setupWizard: boolean;
  narrationLm: boolean;
}

interface AssistState {
  serviceState: "healthy" | "degraded" | "failing" | "offline";
  enabled: boolean;
  features: AssistFeatureToggles;
  diagnosticSnapshots: AssistDiagnosticSnapshot[];
  suggestions: AssistSuggestion[];
  repairQueue: AssistRepairItem[];
  prDrafts: AssistPrDraft[];
  fleetPatterns: AssistFleetPattern[];
  activeWizardId: string | null;
}

interface AssistActions {
  setServiceState: (state: AssistState["serviceState"]) => void;
  setEnabled: (enabled: boolean) => void;
  setFeatures: (features: Partial<AssistFeatureToggles>) => void;
  setDiagnosticSnapshots: (snapshots: AssistDiagnosticSnapshot[]) => void;
  setSuggestions: (suggestions: AssistSuggestion[]) => void;
  setRepairQueue: (queue: AssistRepairItem[]) => void;
  setPrDrafts: (drafts: AssistPrDraft[]) => void;
  setFleetPatterns: (patterns: AssistFleetPattern[]) => void;
  setActiveWizardId: (id: string | null) => void;
  clear: () => void;
}

const DEFAULT_FEATURES: AssistFeatureToggles = {
  diagnostics: false,
  suggestions: false,
  selfHealing: false,
  prDrafts: false,
  fleetPatterns: false,
  setupWizard: true,
  narrationLm: false,
};

export const useAssistStore = create<AssistState & AssistActions>((set) => ({
  serviceState: "offline",
  enabled: false,
  features: DEFAULT_FEATURES,
  diagnosticSnapshots: [],
  suggestions: [],
  repairQueue: [],
  prDrafts: [],
  fleetPatterns: [],
  activeWizardId: null,

  setServiceState: (serviceState) => set({ serviceState }),
  setEnabled: (enabled) => set({ enabled }),
  setFeatures: (partial) => set((s) => ({ features: { ...s.features, ...partial } })),
  setDiagnosticSnapshots: (diagnosticSnapshots) => set({ diagnosticSnapshots }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setRepairQueue: (repairQueue) => set({ repairQueue }),
  setPrDrafts: (prDrafts) => set({ prDrafts }),
  setFleetPatterns: (fleetPatterns) => set({ fleetPatterns }),
  setActiveWizardId: (activeWizardId) => set({ activeWizardId }),

  clear: () =>
    set({
      serviceState: "offline",
      enabled: false,
      features: DEFAULT_FEATURES,
      diagnosticSnapshots: [],
      suggestions: [],
      repairQueue: [],
      prDrafts: [],
      fleetPatterns: [],
      activeWizardId: null,
    }),
}));
