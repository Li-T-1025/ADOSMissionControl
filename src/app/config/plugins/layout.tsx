"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface InnerTab {
  label: string;
  href: string;
  /** Active when the pathname is exactly this href. */
  exact?: boolean;
}

// The hosted registry browser (`/config/plugins/browse`) talks to a REST
// host that is not live yet, so its tab is withheld to avoid a dead,
// always-unreachable surface. Plugins are discovered + installed per
// drone from the dashboard Plugins tab (Convex-served registry grid).
// Restore this entry once the hosted REST registry is serving.
const innerTabs: ReadonlyArray<InnerTab> = [
  { label: "Installed", href: "/config/plugins", exact: true },
];

export default function PluginsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const onBrowse = pathname.startsWith("/config/plugins/browse");
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border-default bg-bg-tertiary/40 px-4">
        <nav
          className="flex gap-1"
          aria-label="Plugins section navigation"
        >
          {innerTabs.map((tab) => {
            const isActive =
              tab.href === "/config/plugins/browse"
                ? onBrowse
                : !onBrowse;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-accent-primary text-text-primary"
                    : "border-transparent text-text-tertiary hover:text-text-primary",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
