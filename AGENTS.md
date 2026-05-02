# AGENTS.md - ADOS Mission Control

Agentic coding instructions for ADOS Mission Control, the open-source browser
ground control station.

## Stack and Commands

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, Zustand 5.
- Dev server port: `4000`.
- Commands:

```bash
npm run dev
npm run demo
npm run build
npm run lint
npm test -- --run
npm run desktop:dev
```

Use `npm run demo` for UI work unless real hardware behavior is required.

## Architecture Guidelines

- Flight-controller operations go through the `DroneProtocol` interface.
  Components should not call protocol-specific MAVLink or MSP helpers directly.
- FC panels that read or write parameters use `usePanelParams`, shared panel UI,
  armed-state locking, and unsaved-change guards.
- Telemetry time series use bounded ring buffers. Do not store unbounded arrays
  for live telemetry.
- Demo mode must keep working for new features. Add mock params and mock
  protocol stubs when needed.
- Convex queries must pass `"skip"` when auth, demo mode, or runtime context is
  unavailable.

## TypeScript and UI

- Keep TypeScript strict. Avoid `any`; use explicit domain types or `unknown`
  with narrowing at boundaries.
- Interactive App Router components need `"use client"` at the top.
- Subscribe to Zustand stores with selectors. Avoid broad `useStore()` calls in
  React components.
- Use the shared `<Select>` component for dropdowns, not native `<select>`.
- Use design tokens and dark-theme variables. Avoid hardcoded colors.

## File Patterns

- FC panels: `src/components/fc/*Panel.tsx`
- Indicators: `src/components/indicators/*Indicator.tsx`
- Stores: `src/stores/*-store.ts`, split large stores into domain slices.
- Protocol types: `src/lib/protocol/types/`
- MAVLink messages: `src/lib/protocol/messages/`
- Encoders: `src/lib/protocol/encoders/`
- Pattern generators: `src/lib/patterns/*-generator.ts`
- File formats: `src/lib/formats/`

Keep code files near 300 lines when practical. Split files before they become
hard to review, except for generated files, fixtures, data tables, and vendored
code.

## Repository Boundary

Keep repo instructions, docs, comments, tests, and examples self-contained and
technical. Document behavior through code architecture, APIs, commands, schemas,
hardware interfaces, deployment steps, and operator workflows. Keep this
repository self-contained. Describe integrations through documented APIs,
package names, public protocols, and public project links.

## Related Public Projects

- [ADOS Drone Agent](https://github.com/altnautica/ADOSDroneAgent) - companion
  and ground-node agent that Mission Control can connect to.
- [ADOS Documentation](https://github.com/altnautica/Documentation) - public
  docs for user and developer workflows.
