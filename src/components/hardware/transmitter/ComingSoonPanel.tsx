"use client";

/**
 * @module ComingSoonPanel
 * @description Placeholder panel for Edge routes whose full UI lands in
 * a later wave. Shows a single card with a heading, body copy, and an
 * optional feature-list preview so the operator knows what to expect.
 * @license GPL-3.0-only
 */

import type { ReactNode } from "react";

export interface ComingSoonPanelProps {
  title: string;
  body: string;
  features?: string[];
  footer?: ReactNode;
}

export function ComingSoonPanel({ title, body, features, footer }: ComingSoonPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <header>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{body}</p>
      </header>

      {features && features.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-secondary p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            What this tab will cover
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-text-secondary">
            {features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-accent-primary">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {footer && <div className="text-xs text-text-muted">{footer}</div>}
    </div>
  );
}
