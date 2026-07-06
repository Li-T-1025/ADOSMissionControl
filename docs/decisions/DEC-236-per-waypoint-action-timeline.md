---
id: DEC-236
date: 2026-07-06
status: DRAFT
supersedes: []
superseded_by: []
tags: [gcs, oss, spec, process, fc]
---

## Decision

Mission waypoints gain a nested per-waypoint action timeline. A `Waypoint` (always
a navigation command that owns a physical position) carries an optional ordered
`actions: MissionAction[]` list of non-navigation commands (set-speed, yaw, camera
trigger, jump, ROI, delay, servo, etc.) that the flight controller executes at or
between waypoints. The flat `WaypointCommand` union is split into two disjoint,
exhaustively-classified sub-unions — `NavCommand` (12 members, each owns a
waypoint) and `ActionCommand` (16 members, each attaches to the preceding
waypoint) — with `WaypointCommand = NavCommand | ActionCommand`, keeping the
external union byte-identical so nothing else in the codebase breaks.

The wire mapping is centralized in one pure module (`src/lib/mission/mission-expand.ts`)
that is the single source of truth for how the waypoint model maps onto the MAVLink
mission wire format:

- `expandToItems(waypoints, { defaultFrame })` flattens the nested model into a
  contiguously-sequenced `MissionItem[]`. A navigation waypoint occupies `seq = k`;
  its actions follow at `seq = k+1 … k+m`; the next navigation waypoint starts at
  `seq = k+m+1`. The `items[i].seq === i` invariant is asserted at runtime (a wrong
  `seq` on real hardware is a crash).
- `collapseFromItems(items)` is the inverse (download / import path).
- `foldLegacyWaypoints(flat)` migrates a legacy flat list (action commands as
  their own top-level rows) into the nested model, and is idempotent.

Navigation items keep the exact legacy one-slot-shift byte mapping
(`holdTime → param1`, `param1 → param2`, `param2 → param3`, `param3 → param4`), so
this change alters not a single byte of an existing action-free mission. Action
items use correct MAVLink parameter slots (`param1..param4` straight through;
`x/y/z = 0` except position-bearing `ROI` / `DO_SET_HOME`, which carry
lat/lon/alt; frame inherited from the parent navigation waypoint).

`DO_JUMP` is modeled by a stable `jumpTargetId` referencing the target navigation
waypoint's `id`, resolved to a flattened target `seq` at encode time (a two-pass
expand: emit all items and record NAV `id → seq`, then fill each `DO_JUMP` item's
`param1` with the target seq and `param2` with the repeat count). This fixes a
pre-existing correctness bug: under the legacy one-slot-shift, a `DO_JUMP`'s
intended target index landed in `param2` and its raw `param1` slot went to the
holdTime value, so the flight controller read a wrong (often zero → home) jump
target. Modeling the jump by waypoint id decouples it from raw sequence indices
that shift as the mission is edited, and lets the target survive add/delete/reorder.
An unresolved or missing `jumpTargetId` drops that `DO_JUMP` item and re-tightens
the sequence so contiguity holds.

This step ships only the pure correctness core plus its unit tests. The store /
serialization / UI wiring lands next: a 3-layer migration (mission-store `v2 → v3`,
`.altmission` `v1 → v2`, plan-library `v3 → v4`) all funneling through
`foldLegacyWaypoints`, the upload/download seam re-pointed at `expandToItems` /
`collapseFromItems`, and the waypoint editor timeline UI.

## Context

The mission upload seam mapped a `Waypoint` one-to-one to a `MissionItem` with a
one-slot parameter shift, and non-navigation commands (`DO_SET_SPEED`,
`CONDITION_YAW`, `ROI`, `DO_JUMP`, …) had to be authored as their own top-level
"waypoint" rows. That flat model has three problems: (1) actions clutter the
waypoint list and cannot be grouped with the waypoint they belong to; (2) the
one-slot shift is correct for navigation items but silently corrupts action
commands whose real semantics live in `param1` (most visibly `DO_JUMP`, whose
target seq must be `param1`); (3) jumps referenced raw sequence indices that break
the instant a waypoint is inserted or deleted upstream.

Nesting actions under their owning navigation waypoint mirrors how planners
(Mission Planner / QGC) present the mission to an operator, makes the wire mapping
a single testable pure function, and lets `DO_JUMP` be expressed as a durable
reference rather than a fragile index. Keeping the navigation byte mapping identical
means the change is provably non-regressive for every existing mission (a
byte-identity unit test pins this), and a compile-time exhaustiveness guard over
the nav/action classification forces any future command added to the union to be
explicitly classified rather than silently misrouted.

Resolved ambiguities baked into this step:

- **`MissionAction` position** is meaningful only for `ROI` and `DO_SET_HOME`
  (encoded into `x/y/z`); all other actions encode `x = y = z = 0`.
- **Leading orphan actions** (an action with no preceding navigation waypoint) are
  dropped, with a `console.warn` on the migration path.
- **The `LOITER_TURNS` holdTime wart** in the legacy navigation mapping is preserved
  untouched (byte-identity over correctness-tidying, deferred).
- **Frame is not restored onto waypoints on collapse** (matches existing
  mission-download behavior); `0` parameter slots collapse to `undefined` and
  re-expand to `0`, so round-trips are byte-exact.
- **SITL round-trip validation** of the corrected `DO_JUMP` behavior against real
  ArduPilot is a QA step for the wiring build, not this pure core.
