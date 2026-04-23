/**
 * @license GPL-3.0-only
 */
import { Construction } from "lucide-react";

interface ComingSoonProps {
  label?: string;
}

export function ComingSoon({ label }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
      <Construction size={32} className="opacity-40" />
      <p className="text-sm font-medium opacity-60">
        {label ?? "Coming soon"}
      </p>
    </div>
  );
}
