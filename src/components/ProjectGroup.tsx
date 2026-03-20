// src/components/ProjectGroup.tsx
// Collapsible group with project header and process list.

import { memo, useCallback } from "react";
import ProcessItem from "@/components/ProcessItem";
import { ChevronIcon, FolderIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";
import type { ProjectGroup } from "@/types";

interface ProjectGroupProps {
  group: ProjectGroup;
}

/** Convert a raw project name to Title Case for display. */
function toTitleCase(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const ProjectGroupComponent = memo(function ProjectGroupComponent({
  group,
}: ProjectGroupProps) {
  const collapsed = useProcessStore((s) =>
    s.collapsedProjects.has(group.name)
  );
  const toggle = useProcessStore((s) => s.toggleProjectCollapsed);

  const handleToggle = useCallback(() => {
    toggle(group.name);
  }, [toggle, group.name]);

  return (
    <div
      role="group"
      aria-label={`${group.name} project`}
      className="mt-2 first:mt-0"
    >
      {/* Separator above each group except the first */}
      <div className="mx-4 mb-1 border-t border-surface-200 dark:border-surface-700/70 first:hidden" />

      {/* Project name header -- clickable to collapse */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-surface-400/50"
        aria-expanded={!collapsed}
        aria-controls={`group-${group.name}`}
      >
        <FolderIcon
          size={13}
          className="flex-shrink-0 text-surface-400 dark:text-surface-500"
        />
        <span className="flex-1 truncate text-[13px] font-semibold text-surface-800 dark:text-surface-100 tracking-tight text-left">
          {toTitleCase(group.name)}
          <span className="ml-1.5 text-[12px] font-normal text-surface-400 dark:text-surface-500">
            ({group.processes.length})
          </span>
        </span>
        <ChevronIcon
          size={11}
          className={`flex-shrink-0 text-surface-400 dark:text-surface-500 transition-transform duration-150 ${
            collapsed ? "-rotate-90" : "rotate-0"
          }`}
        />
      </button>

      {/* Process list */}
      {!collapsed && (
        <div
          id={`group-${group.name}`}
          role="list"
          aria-label={`Processes in ${group.name}`}
          className="pb-1"
        >
          {group.processes.map((process) => (
            <ProcessItem key={process.pid} process={process} />
          ))}
        </div>
      )}
    </div>
  );
});

export default ProjectGroupComponent;
