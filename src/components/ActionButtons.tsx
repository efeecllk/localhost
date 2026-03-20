// src/components/ActionButtons.tsx
// Grid of action buttons for the detail panel.

import { memo, useState, useCallback } from "react";
import {
  StopIcon,
  RestartIcon,
  TerminalIcon,
  CodeIcon,
  GlobeIcon,
  ClipboardIcon,
  CheckIcon,
} from "@/components/icons";
import { useProcessStore } from "@/stores/processStore";
import type { Process } from "@/types";

interface ActionButtonsProps {
  process: Process;
}

const ActionButtons = memo(function ActionButtons({
  process,
}: ActionButtonsProps) {
  const stopProcess = useProcessStore((s) => s.stopProcess);
  const restartProcess = useProcessStore((s) => s.restartProcess);
  const openInTerminal = useProcessStore((s) => s.openInTerminal);
  const openInEditor = useProcessStore((s) => s.openInEditor);
  const openInBrowser = useProcessStore((s) => s.openInBrowser);
  const editorCommand = useProcessStore((s) => s.settings.editorCommand);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = useCallback(
    (value: string, field: string) => {
      navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    },
    []
  );

  const isDocker = process.source === "docker";

  // Derive editor label from command
  const editorLabel: Record<string, string> = {
    code: "VS Code",
    cursor: "Cursor",
    zed: "Zed",
    subl: "Sublime",
    idea: "IntelliJ",
  };

  const actions = [
    {
      label: isDocker ? "Stop Ctn" : "Stop",
      icon: <StopIcon size={14} />,
      onClick: () => stopProcess(process),
      variant: "danger" as const,
    },
    {
      label: isDocker ? "Restart Ctn" : "Restart",
      icon: <RestartIcon size={14} />,
      onClick: () => restartProcess(process),
      variant: "default" as const,
    },
    // Terminal and Editor only for non-Docker processes
    ...(!isDocker
      ? [
          {
            label: "Terminal",
            icon: <TerminalIcon size={14} />,
            onClick: () => openInTerminal(process.fullPath),
            variant: "default" as const,
          },
          {
            label: editorLabel[editorCommand] ?? editorCommand,
            icon: <CodeIcon size={14} />,
            onClick: () => openInEditor(process.fullPath),
            variant: "default" as const,
          },
        ]
      : []),
    // Browser only if port exists
    ...(process.port
      ? [
          {
            label: "Browser",
            icon: <GlobeIcon size={14} />,
            onClick: () => openInBrowser(process.port!),
            variant: "default" as const,
          },
        ]
      : []),
    // Copy Port only if port exists
    ...(process.port
      ? [
          {
            label: copiedField === "port" ? "Copied" : "Copy Port",
            icon:
              copiedField === "port" ? (
                <CheckIcon size={14} className="text-emerald-500" />
              ) : (
                <ClipboardIcon size={14} />
              ),
            onClick: () => handleCopy(String(process.port), "port"),
            variant: "default" as const,
          },
        ]
      : []),
    // Copy Path always
    {
      label: copiedField === "path" ? "Copied" : "Copy Path",
      icon:
        copiedField === "path" ? (
          <CheckIcon size={14} className="text-emerald-500" />
        ) : (
          <ClipboardIcon size={14} />
        ),
      onClick: () => handleCopy(process.fullPath, "path"),
      variant: "default" as const,
    },
  ];

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-800 p-3">
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[11px] font-medium transition-colors ${
              action.variant === "danger"
                ? "hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            }`}
          >
            {action.icon}
            <span className="truncate w-full text-center">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default ActionButtons;
