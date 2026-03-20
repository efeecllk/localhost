// src/components/ProjectGroup.tsx
// Collapsible group with project header and process list.

import { memo, useCallback } from "react";
import ProcessItem from "@/components/ProcessItem";
import { ChevronIcon } from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";
import type { ProjectGroup } from "@/types";

interface ProjectGroupProps {
  group: ProjectGroup;
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
      className="border-b border-surface-200/50 dark:border-surface-700/50 last:border-b-0"
    >
      {/* Project name header -- clickable to collapse */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-surface-400/50"
        aria-expanded={!collapsed}
        aria-controls={`group-${group.name}`}
      >
        <ChevronIcon
          size={10}
          className={`flex-shrink-0 text-surface-400 dark:text-surface-500 transition-transform duration-150 ${
            collapsed ? "-rotate-90" : "rotate-0"
          }`}
        />
        <span className="truncate">{group.name}</span>
        <span className="ml-auto flex-shrink-0 bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400 text-[10px] font-medium px-1.5 py-0.5 rounded-full tabular-nums">
          {group.processes.length}
        </span>
      </button>

      {/* Process list -- animated collapse */}
      {!collapsed && (
        <div
          id={`group-${group.name}`}
          role="list"
          aria-label={`Processes in ${group.name}`}
          className="space-y-px"
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
