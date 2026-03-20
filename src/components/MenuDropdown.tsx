// src/components/MenuDropdown.tsx
// Main container view. Assembles Header, ProjectList/EmptyState, and Footer.

import { memo } from "react";
import Header from "@/components/Header";
import ProjectList from "@/components/ProjectList";
import Footer from "@/components/Footer";
import EmptyState from "@/components/EmptyState";
import {
  useProcessStore,
  selectTotalProcesses,
} from "@/stores/processStore";

const MenuDropdown = memo(function MenuDropdown() {
  const projects = useProcessStore((s) => s.projects);
  const error = useProcessStore((s) => s.error);
  const totalProcesses = useProcessStore(selectTotalProcesses);

  return (
    <div className="flex flex-col h-full max-h-[500px] w-[360px] bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      <Header />

      {/* Error banner */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Scrollable process list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {totalProcesses === 0 ? (
          <EmptyState />
        ) : (
          <ProjectList projects={projects} />
        )}
      </div>

      <Footer />
    </div>
  );
});

export default MenuDropdown;
