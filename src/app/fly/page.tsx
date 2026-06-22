"use client";

// Immersive Fly cockpit page. Full-screen, game-like piloting cockpit: live
// video, instrument HUD, cockpit chrome, and the bottom Skill Bar. Because the
// cockpit route is short-circuited out of CommandShell, this page mounts the
// agent/video/telemetry bridges and the skill registry itself (see FlyCockpit),
// so the surface is self-sufficient on a chromeless route.
//
// Query params:
//   ?drone=<id>     select this drone on mount when it differs from the current
//                   selection (so a refresh never wipes a live selection).
//   ?layer=minimal  render the low-power path (video + instrument HUD only) for
//                   thermally-constrained SBCs, mirroring /hud?layer=minimal.

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useDroneManager } from "@/stores/drone-manager";
import { FlyCockpit } from "@/components/fly/FlyCockpit";

export default function FlyPage() {
  return (
    <Suspense fallback={<FlyBootFallback />}>
      <FlyRouter />
    </Suspense>
  );
}

// Shown for the brief moment the Suspense boundary resolves useSearchParams.
function FlyBootFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <span className="text-xs font-mono uppercase tracking-widest text-white/40">
        ...
      </span>
    </div>
  );
}

function FlyRouter() {
  const params = useSearchParams();
  const droneParam = params.get("drone");
  const minimal = params.get("layer") === "minimal";

  // Honor ?drone=<id> exactly once on mount, and only when it differs from the
  // current selection. selectDrone clears cross-drone singletons (telemetry,
  // video, capabilities), so calling it on an already-selected drone after a
  // refresh would wipe live state.
  useEffect(() => {
    if (!droneParam) return;
    const current = useDroneManager.getState().selectedDroneId;
    if (droneParam !== current) {
      useDroneManager.getState().selectDrone(droneParam);
    }
    // Mount-only: a later URL change is handled by re-navigation, not a re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <FlyCockpit minimal={minimal} />;
}
