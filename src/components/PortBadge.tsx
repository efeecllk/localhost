// src/components/PortBadge.tsx
// Compact pill showing port number, color-coded by process type.

import { memo } from "react";
import type { ProcessSource } from "@/types";

type PortType = "web" | "api" | "db" | "docker" | "other";

interface PortBadgeProps {
  port: number | null;
  source: ProcessSource;
  processName?: string; // shown when port is null and source is not docker
}

/**
 * Derive the port type from port number and source.
 * Pure function, easily testable.
 */
function getPortType(port: number | null, source: string): PortType {
  if (source === "docker") return "docker";
  if (port === null) return "other";
  if ([3000, 3001, 5173, 4200, 8080, 1420, 4173, 5174].includes(port))
    return "web";
  if ([8000, 8001, 8002, 4000, 5000, 6000, 3100, 4100].includes(port))
    return "api";
  if ([5432, 5433, 3306, 6379, 6380, 27017, 27018, 5984].includes(port))
    return "db";
  return "other";
}

/**
 * Color styles per port type. Uses Tailwind's built-in palette colors
 * with ring-1 for clean badge borders.
 */
const portTypeStyles: Record<PortType, { light: string; dark: string }> = {
  web: {
    light: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    dark: "dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800/50",
  },
  api: {
    light: "bg-green-50 text-green-700 ring-1 ring-green-200",
    dark: "dark:bg-green-950/40 dark:text-green-300 dark:ring-green-800/50",
  },
  db: {
    light: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dark: "dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/50",
  },
  docker: {
    light: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    dark: "dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50",
  },
  other: {
    light: "bg-surface-100 text-surface-500 ring-1 ring-surface-200",
    dark: "dark:bg-surface-800 dark:text-surface-400 dark:ring-surface-700",
  },
};

const PortBadge = memo(function PortBadge({
  port,
  source,
  processName,
}: PortBadgeProps) {
  const portType = getPortType(port, source);
  const styles = portTypeStyles[portType];

  // Determine display text
  let displayText: string;
  if (port !== null) {
    displayText = `:${port}`;
  } else if (source === "docker") {
    displayText = "docker";
  } else {
    displayText = processName ?? "----";
  }

  return (
    <span
      className={`
        inline-flex items-center justify-center
        min-w-[52px] px-2 py-0.5
        rounded-md text-[11px] font-mono font-medium text-center
        flex-shrink-0
        ${styles.light} ${styles.dark}
      `}
    >
      {displayText}
    </span>
  );
});

export default PortBadge;
