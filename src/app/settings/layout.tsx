"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";

const tabs: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Plugins", href: "/settings/plugins" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border-default bg-bg-secondary px-4">
        <nav className="flex gap-1" aria-label="Settings navigation">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
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
