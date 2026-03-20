// src/components/ProjectList.tsx
// Scrollable container that holds all ProjectGroup components.

import { memo } from "react";
import ProjectGroupComponent from "@/components/ProjectGroup";
import type { ProjectGroup } from "@/types";

interface ProjectListProps {
  projects: ProjectGroup[];
}

const ProjectList = memo(function ProjectList({ projects }: ProjectListProps) {
  return (
    <div
      aria-label="Running processes grouped by project"
      className="py-1"
    >
      {projects.map((group) => (
        <ProjectGroupComponent key={group.name} group={group} />
      ))}
    </div>
  );
});

export default ProjectList;
