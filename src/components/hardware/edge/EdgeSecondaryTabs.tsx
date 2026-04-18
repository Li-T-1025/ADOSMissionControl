"use client";

/**
 * @module EdgeSecondaryTabs
 * @description Horizontal sub-navigation rendered inside the ADOS Edge
 * category. Each entry maps to a route under /hardware/edge/*. Renders only
 * once a transmitter is connected.
 * @license GPL-3.0-only
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface EdgeTab {
  key: string;
  href: string;
}

const TABS: EdgeTab[] = [
  { key: "dashboard", href: "/hardware/edge" },
  { key: "live", href: "/hardware/edge/live" },
  { key: "models", href: "/hardware/edge/models" },
  { key: "mixer", href: "/hardware/edge/mixer" },
  { key: "calibrate", href: "/hardware/edge/calibrate" },
  { key: "elrs", href: "/hardware/edge/elrs" },
  { key: "firmware", href: "/hardware/edge/firmware" },
  { key: "system", href: "/hardware/edge/system" },
  { key: "logs", href: "/hardware/edge/logs" },
  { key: "advanced", href: "/hardware/edge/advanced" },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/hardware/edge") return false;
  return pathname.startsWith(`${href}/`);
}

export function EdgeSecondaryTabs() {
  const pathname = usePathname();
  const t = useTranslations("hardware.edge.tabs");

  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b border-border-default">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-xs transition-colors",
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
