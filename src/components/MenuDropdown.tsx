// src/components/MenuDropdown.tsx
// Main container view. Assembles Header, ProjectList/EmptyState, and Footer.

import { memo, useCallback } from "react";
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
  const clearError = useProcessStore((s) => s.clearError);
  const fetchProcesses = useProcessStore((s) => s.fetchProcesses);
  const totalProcesses = useProcessStore(selectTotalProcesses);

  const handleRetry = useCallback(() => {
    clearError();
    fetchProcesses();
  }, [clearError, fetchProcesses]);

  return (
    <div className="flex flex-col h-full w-full bg-surface-50 dark:bg-surface-950 overflow-hidden">
      <Header />

      {/* Error banner with dismiss and retry */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-[11px] text-red-600 dark:text-red-400 flex items-start gap-2 animate-slide-down">
          <span className="flex-1 break-words">{error}</span>
          <button
            onClick={handleRetry}
            className="flex-shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50 rounded"
          >
            Retry
          </button>
          <button
            onClick={clearError}
            className="flex-shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50 rounded"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Scrollable process list */}
      <div className="flex-1 overflow-y-auto min-h-0 process-list">
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
