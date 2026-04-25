"use client";

/**
 * @module TabErrorBoundary
 * @description Wraps a lazy-loaded Command sub-tab so a render or chunk-load
 *   failure inside one tab does not blank the whole shell. The fallback is
 *   neutral copy with a refresh CTA; the error is logged to the console for
 *   developer triage.
 * @license GPL-3.0-only
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface TabErrorBoundaryProps {
  children: ReactNode;
}

interface TabErrorBoundaryState {
  hasError: boolean;
}

export class TabErrorBoundary extends Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  state: TabErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): TabErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the failure for developer triage; the fallback UI handles users.
    console.error("[TabErrorBoundary]", error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-text-secondary">
            This view failed to load. Try refreshing or switching tabs.
          </p>
          <button
            onClick={this.handleReset}
            className="px-3 py-1 text-xs font-medium text-accent-primary border border-accent-primary/30 rounded hover:bg-accent-primary/10 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
