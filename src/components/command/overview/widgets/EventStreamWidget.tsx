"use client";

export function EventStreamWidget() {
  return (
    <div className="p-3 h-full flex flex-col">
      <span className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Events</span>
      <div className="flex-1 overflow-y-auto text-xs text-text-secondary">
        <div className="text-text-tertiary">No events yet</div>
      </div>
    </div>
  );
}
