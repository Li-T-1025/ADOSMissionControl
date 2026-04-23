"use client";
import { MapPin } from "lucide-react";

export function MiniMapWidget() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-surface-tertiary/20 text-text-tertiary">
      <MapPin size={20} className="opacity-30" />
      <p className="text-xs mt-1 opacity-50">Map view</p>
    </div>
  );
}
