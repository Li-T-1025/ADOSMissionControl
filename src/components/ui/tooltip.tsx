"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  // string keeps the original one-line tooltip behavior; ReactNode
  // enables richer multi-line content (e.g. metric explanations in the
  // video latency breakdown popover).
  content: string | ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  // Default content is single-line ("whitespace-nowrap"). Set
  // multiline when the content needs to wrap, which also widens the
  // tooltip to a fixed max width.
  multiline?: boolean;
  className?: string;
}

const positionStyles: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

export function Tooltip({
  content,
  children,
  position = "top",
  multiline = false,
  className,
}: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={cn(
            "absolute z-[2000] px-2 py-1 text-[10px] font-medium",
            multiline ? "max-w-[220px] leading-snug" : "whitespace-nowrap",
            "bg-bg-tertiary border border-border-default text-text-primary",
            positionStyles[position],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
