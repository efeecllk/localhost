// src/App.tsx
// Root component: view routing, theme management, polling initialization.

import { useEffect, useCallback, lazy, Suspense } from "react";
import { useProcessStore } from "@/stores/processStore";
import { useProcessPoller } from "@/hooks/useProcessPoller";
import MenuDropdown from "@/components/MenuDropdown";

const Settings = lazy(() => import("@/components/Settings"));
const DetailPanel = lazy(() => import("@/components/DetailPanel"));

function App() {
  const view = useProcessStore((s) => s.view);
  const theme = useProcessStore((s) => s.settings.theme);
  const loadSettings = useProcessStore((s) => s.loadSettings);

  // Start polling
  useProcessPoller();

  // Load persisted settings from Rust on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Theme management (same pattern as voice-prompt)
  const applyTheme = useCallback((isDark: boolean) => {
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    applyTheme(theme === "dark");
  }, [theme, applyTheme]);

  const renderView = () => {
    switch (view) {
      case "settings":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Settings />
          </Suspense>
        );
      case "detail":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <DetailPanel />
          </Suspense>
        );
      default:
        return <MenuDropdown />;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100">
      {renderView()}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full w-[360px]">
      <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
    </div>
  );
}

export default App;
