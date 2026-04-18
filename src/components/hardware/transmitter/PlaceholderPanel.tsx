"use client";

/**
 * @module PlaceholderPanel
 * @description Shared informational card for features whose firmware
 * CDC surface is not in the v0.1.0 cut. Keeps the route navigation
 * consistent while the underlying commands land.
 * @license GPL-3.0-only
 */

import Link from "next/link";

interface PlaceholderPanelProps {
  title: string;
  summary: string;
  availability: string;
  links?: { label: string; href: string }[];
}

export function PlaceholderPanel({ title, summary, availability, links }: PlaceholderPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>

      <div className="rounded-lg border border-border bg-surface-secondary p-6">
        <p className="text-sm text-text-secondary">{summary}</p>
        <p className="mt-3 text-xs text-text-muted">{availability}</p>

        {links && links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex h-9 items-center rounded border border-border px-3 text-sm text-text-primary hover:bg-surface-hover"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
