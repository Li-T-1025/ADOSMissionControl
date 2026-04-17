"use client";

/**
 * @module HardwareTabs
 * @description Secondary nav for the Hardware tab: Overview, Network,
 * Physical UI, Controllers, Peripherals, plus Distributed RX and Mesh
 * sub-tabs that appear only on mesh-capable ground stations.
 * @license GPL-3.0-only
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useGroundStationStore } from "@/stores/ground-station-store";
import { cn } from "@/lib/utils";

const BASE_TABS: { href: string; key: string }[] = [
  { href: "/hardware", key: "overview" },
  { href: "/hardware/network", key: "network" },
  { href: "/hardware/ui", key: "physicalUi" },
  { href: "/hardware/controllers", key: "controllers" },
  { href: "/hardware/peripherals", key: "peripherals" },
];

export function HardwareTabs() {
  const pathname = usePathname();
  const t = useTranslations("hardware.tabs");
  const profile = useGroundStationStore((s) => s.status.profile);
  const meshCapable = useGroundStationStore(
    (s) => s.role.info?.mesh_capable ?? false,
  );

  const tabs = useMemo(() => {
    const visible = [...BASE_TABS];
    if (profile === "ground_station" && meshCapable) {
      visible.push({ href: "/hardware/distributed-rx", key: "distributedRx" });
      visible.push({ href: "/hardware/mesh", key: "mesh" });
    }
    return visible;
  }, [profile, meshCapable]);

  return (
    <nav className="mb-5 flex flex-wrap gap-1 border-b border-border-primary/60">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-2 text-sm transition-colors border-b-2 -mb-px",
              active
                ? "border-accent-primary text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
