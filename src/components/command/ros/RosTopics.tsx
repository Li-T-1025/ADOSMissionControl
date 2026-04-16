"use client";

/**
 * @module RosTopics
 * @description Topics table sub-view for the ROS tab.
 * Displays active ROS 2 topics with types, publisher/subscriber counts, and rates.
 * @license GPL-3.0-only
 */

import { useState, useMemo } from "react";
import { Radio, Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useRosStore } from "@/stores/ros-store";

const SORT_OPTIONS = [
  { value: "name", label: "Sort by name" },
  { value: "type", label: "Sort by type" },
  { value: "rate", label: "Sort by rate" },
];

export function RosTopics() {
  const topics = useRosStore((s) => s.topics);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "type" | "rate">("name");

  const filtered = useMemo(() => {
    let result = [...topics];

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q),
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "type":
          return a.type.localeCompare(b.type);
        case "rate":
          return (b.rate_hz ?? 0) - (a.rate_hz ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [topics, search, sortBy]);

  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-secondary text-sm">
        <Radio className="w-8 h-8 mb-2 text-text-tertiary" />
        No topics available. Start the ROS environment to see active topics.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + sort bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Filter topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-secondary border border-border-primary rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
          />
        </div>
        <Select
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={(v) => setSortBy(v as typeof sortBy)}
        />
      </div>

      {/* Count */}
      <p className="text-xs text-text-secondary">
        {filtered.length} topic{filtered.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
      </p>

      {/* Table */}
      <div className="bg-surface-secondary rounded-lg border border-border-primary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary text-text-secondary text-xs">
              <th className="text-left px-4 py-2 font-medium">Topic</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-center px-4 py-2 font-medium">Pub</th>
              <th className="text-center px-4 py-2 font-medium">Sub</th>
              <th className="text-right px-4 py-2 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((topic) => (
              <tr
                key={topic.name}
                className="border-b border-border-primary/50 hover:bg-surface-tertiary/50 transition-colors"
              >
                <td className="px-4 py-2 font-mono text-accent-primary text-xs">{topic.name}</td>
                <td className="px-4 py-2 font-mono text-text-secondary text-xs truncate max-w-48">
                  {topic.type}
                </td>
                <td className="px-4 py-2 text-center text-text-primary">{topic.publishers}</td>
                <td className="px-4 py-2 text-center text-text-primary">{topic.subscribers}</td>
                <td className="px-4 py-2 text-right font-mono text-text-primary">
                  {topic.rate_hz != null ? `${topic.rate_hz.toFixed(1)} Hz` : "---"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
