# Changelog

All notable changes to ADOS Mission Control are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the project follows [Semantic Versioning](https://semver.org/).

## [0.9.11] - 2026-05-04

This release lands universal-setup integration on the GCS side and
a security + reliability sweep on the cloud-relay surface.

### Added

- **Setup-and-access card.** New shared component at
  `src/components/hardware/SetupAccessCard.tsx`. Reads the agent's
  `/api/v1/setup/status` (or, when no agent is connected locally,
  the most recent cloud-relay snapshot) and shows completion
  percent, the next-action sentence, MAVLink / video / remote-access
  state, and direct links to the agent's setup webapp and any
  advertised tunnel URL.
- **Disconnected-state setup handoff.** The Hardware Overview empty
  state now surfaces "Open setup" when the cloud relay carries an
  advertised setup URL for any drone the operator has paired,
  alongside the existing "Connect ground station" action.
- **Agent client `getSetupStatus()`** at `src/lib/agent/client.ts`
  with a `SetupStatusSchema` zod schema validating the full
  response tree (`SetupStep`, `SetupAccessUrl`, `MavlinkAccess`,
  `VideoAccess`, `RemoteAccessStatus`, `NetworkStatus`).
- **Cloud-relay schema** carries absolute URLs from the agent:
  `setupUrl`, `apiUrl`, `missionControlUrl`, `videoWhepUrl`,
  `mavlinkWsUrl`, and `remoteAccess`. Both `convex/schema.ts` and
  `convex/cmdDroneStatus.ts` accept the new fields, and
  `convex/http.ts` ingests them. The Command fleet store, the
  CloudStatusBridge mapper, and the agent video-session hook
  prefer the absolute URLs over rebuilding from `lastIp + port`.
- **`feat(command)`**: fleet overview tile with live video and
  telemetry. `CommandFleetOverview.tsx` now renders an inline
  WHEP video preview alongside the per-drone telemetry chips,
  driven by the new absolute-URL plumbing on the agent side.
- **`feat(simulation)`**: camera-trigger toggle. Sim drones now
  publish trigger events the planner consumes, with sync-perf
  improvements on the playback path.
- **`feat(planner)`**: conditional UI render based on the active
  plan. Idle / loaded / dirty states diverge cleanly so the
  planner does not animate empty panels on cold start.
- **`feat(cli)`**: production-deployment wizard and service-
  management subcommands on the `altnautica-command` CLI. Prompts
  walk through TLS, MQTT, video-relay, and Convex bindings; the
  service subcommand wraps `systemctl` for the standard units.
  Public-docs entry at `docs/cli-reference.md` and self-hosting
  guide updated.
- **`AGENTS.md`** with agentic-coding instructions for AI contributors.

### Changed

- **Hardware Overview poll on `/api/v1/setup/status`** gained a
  visibility guard so it pauses while the tab is hidden, matching
  the ground-station poll on the same page.
- **CommandFleetOverview** prefers absolute `videoWhepUrl` and
  `mavlinkWsUrl` advertised by the agent before falling back to
  the previous `lastIp + port` reconstruction.

### Fixed

- **`fix(cloud-relay)`**: agent-facing HTTP routes are now backed
  by Convex internal mutations only. External callers can no
  longer reach the heartbeat write path directly.
- **`fix(CloudStatusBridge)`**: the bridge no longer enqueues
  cloud commands when the user is unauthenticated; previously a
  silent failure path could fire commands during sign-out.
- **`fix(use-agent-video-session)`**: null-check before assigning
  `srcObject` to the video element. Closes a TypeError on disconnect.
- **`fix`**: prevent connection attempt when `whepUrl` is missing.
  The video pipeline used to fire WebRTC negotiation against
  `undefined` after a partial cloud-status snapshot.
- **`fix(ui)`**: escape quotes in UI text and clean up test mocks
  flagged by the linter.
- **`fix`**: input validation, response limits, and safety overrides
  on the agent-facing surface. Bounds requests that previously
  could wedge the relay on malformed payloads.

### Notes

- Pairs with ADOS Drone Agent v0.10.0 (universal setup contract).
- Mission Control still consumes `lastIp + port` as a fallback so
  older agents continue to work without re-pairing.
- Convex schema is in sync with the website's `convex/schema.ts`
  per the dual-Convex convention.
