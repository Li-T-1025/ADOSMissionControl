import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMissionStore } from '@/stores/mission-store';
import type { Waypoint } from '@/lib/types';

// Mock dependencies
vi.mock('@/stores/drone-manager', () => ({
  useDroneManager: {
    getState: () => ({ getSelectedProtocol: () => null }),
    setState: vi.fn(),
  },
}));
vi.mock('@/stores/planner-store', () => ({
  usePlannerStore: {
    getState: () => ({ defaultFrame: 'relative' }),
    setState: vi.fn(),
  },
}));
vi.mock('@/lib/storage', () => ({
  indexedDBStorage: {
    storage: () => ({
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

function makeWaypoint(overrides: Partial<Waypoint> = {}): Waypoint {
  return {
    id: Math.random().toString(36).slice(2, 10),
    lat: 12.97,
    lon: 77.59,
    alt: 50,
    ...overrides,
  };
}

describe('mission-store', () => {
  beforeEach(() => {
    useMissionStore.setState({
      activeMission: null,
      waypoints: [],
      progress: 0,
      currentWaypoint: 0,
      uploadState: 'idle',
      downloadState: 'idle',
      undoStack: [],
      redoStack: [],
    });
  });

  it('initial state has empty waypoints', () => {
    const state = useMissionStore.getState();
    expect(state.waypoints).toEqual([]);
    expect(state.activeMission).toBeNull();
    expect(state.uploadState).toBe('idle');
  });

  it('addWaypoint() appends waypoint', () => {
    const wp = makeWaypoint({ id: 'wp-1' });
    useMissionStore.getState().addWaypoint(wp);

    const state = useMissionStore.getState();
    expect(state.waypoints).toHaveLength(1);
    expect(state.waypoints[0].id).toBe('wp-1');
  });

  it('removeWaypoint() removes by ID', () => {
    const wp1 = makeWaypoint({ id: 'wp-1' });
    const wp2 = makeWaypoint({ id: 'wp-2' });
    useMissionStore.getState().addWaypoint(wp1);
    useMissionStore.getState().addWaypoint(wp2);

    expect(useMissionStore.getState().waypoints).toHaveLength(2);

    useMissionStore.getState().removeWaypoint('wp-1');
    const state = useMissionStore.getState();
    expect(state.waypoints).toHaveLength(1);
    expect(state.waypoints[0].id).toBe('wp-2');
  });

  it('updateWaypoint() modifies specific waypoint', () => {
    const wp = makeWaypoint({ id: 'wp-1', alt: 50 });
    useMissionStore.getState().addWaypoint(wp);

    useMissionStore.getState().updateWaypoint('wp-1', { alt: 100 });

    const updated = useMissionStore.getState().waypoints[0];
    expect(updated.alt).toBe(100);
    expect(updated.lat).toBe(12.97); // unchanged
  });

  it('reorderWaypoints() changes order', () => {
    const wp1 = makeWaypoint({ id: 'wp-1' });
    const wp2 = makeWaypoint({ id: 'wp-2' });
    const wp3 = makeWaypoint({ id: 'wp-3' });

    useMissionStore.getState().addWaypoint(wp1);
    useMissionStore.getState().addWaypoint(wp2);
    useMissionStore.getState().addWaypoint(wp3);

    // Move wp-3 (index 2) to index 0
    useMissionStore.getState().reorderWaypoints(2, 0);

    const ids = useMissionStore.getState().waypoints.map((w) => w.id);
    expect(ids).toEqual(['wp-3', 'wp-1', 'wp-2']);
  });

  it('clearMission() resets to empty', () => {
    const wp = makeWaypoint({ id: 'wp-1' });
    useMissionStore.getState().addWaypoint(wp);
    useMissionStore.getState().createMission('Test Mission', 'drone-1');

    useMissionStore.getState().clearMission();

    const state = useMissionStore.getState();
    expect(state.waypoints).toEqual([]);
    expect(state.activeMission).toBeNull();
    expect(state.progress).toBe(0);
    expect(state.uploadState).toBe('idle');
  });

  it('undo/redo works for addWaypoint', () => {
    const wp1 = makeWaypoint({ id: 'wp-1' });
    const wp2 = makeWaypoint({ id: 'wp-2' });

    useMissionStore.getState().addWaypoint(wp1);
    useMissionStore.getState().addWaypoint(wp2);

    expect(useMissionStore.getState().waypoints).toHaveLength(2);

    // Undo last add
    useMissionStore.getState().undo();
    expect(useMissionStore.getState().waypoints).toHaveLength(1);
    expect(useMissionStore.getState().waypoints[0].id).toBe('wp-1');

    // Redo
    useMissionStore.getState().redo();
    expect(useMissionStore.getState().waypoints).toHaveLength(2);
  });

  it('undo does nothing when stack is empty', () => {
    expect(useMissionStore.getState().waypoints).toEqual([]);
    useMissionStore.getState().undo();
    expect(useMissionStore.getState().waypoints).toEqual([]);
  });

  it('createMission sets up a new mission', () => {
    useMissionStore.getState().createMission('Survey Alpha', 'drone-1');

    const state = useMissionStore.getState();
    expect(state.activeMission).not.toBeNull();
    expect(state.activeMission?.name).toBe('Survey Alpha');
    expect(state.activeMission?.droneId).toBe('drone-1');
    expect(state.waypoints).toEqual([]);
  });

  it('insertWaypoint() inserts at specific index', () => {
    const wp1 = makeWaypoint({ id: 'wp-1' });
    const wp2 = makeWaypoint({ id: 'wp-2' });
    const wpInserted = makeWaypoint({ id: 'wp-mid' });

    useMissionStore.getState().addWaypoint(wp1);
    useMissionStore.getState().addWaypoint(wp2);
    useMissionStore.getState().insertWaypoint(wpInserted, 1);

    const ids = useMissionStore.getState().waypoints.map((w) => w.id);
    expect(ids).toEqual(['wp-1', 'wp-mid', 'wp-2']);
  });
});
