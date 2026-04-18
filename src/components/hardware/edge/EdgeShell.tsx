"use client";

/**
 * @module EdgeShell
 * @description Wrapper for every page under /hardware/edge. When
 * disconnected, shows the PageIntro + connect screen. When connected,
 * replaces the PageIntro with the persistent EdgeChrome status strip
 * and renders the secondary tabs + page content below.
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { PageIntro } from "@/components/hardware/PageIntro";
import { Badge } from "@/components/ui/badge";
import { EdgeChrome } from "./EdgeChrome";
import { EdgeConnectScreen } from "./EdgeConnectScreen";
import { EdgeSecondaryTabs } from "./EdgeSecondaryTabs";

export function EdgeShell({ children }: { children: ReactNode }) {
  const state = useAdosEdgeStore((s) => s.state);
  const t = useTranslations("hardware.intro");
  const tShell = useTranslations("hardware.edge.shell");

  const connected = state === "connected";

  if (connected) {
    return (
      <div className="flex flex-col">
        <EdgeChrome />
        <EdgeSecondaryTabs />
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageIntro
        title={t("edgeTitle")}
        description={t("edgeDescription")}
        trailing={
          <>
            <Badge variant="warning">{tShell("alpha")}</Badge>
            <Badge variant="neutral">{tShell("disconnected")}</Badge>
          </>
        }
      />
      <EdgeConnectScreen />
    </div>
  );
}
