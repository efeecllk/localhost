// src/lib/tauri.ts
// Type-safe wrappers around every Tauri command.
// This is the ONLY file that imports @tauri-apps/api.
// Every component calls these functions instead of invoke directly.

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ProjectGroup, Settings } from "@/types";

/**
 * Fetch all running dev processes, grouped by project.
 * This is the main polling call -- runs every scanInterval ms.
 */
export async function getProcesses(
  projectsDir: string
): Promise<ProjectGroup[]> {
  return invoke<ProjectGroup[]>("get_processes", { projectsDir });
}

/**
 * Send SIGTERM to a native process by PID.
 */
export async function stopProcess(pid: number): Promise<void> {
  return invoke("stop_process", { pid });
}

/**
 * Stop then restart a native process. The Rust side handles
 * re-launching using the original command and cwd.
 */
export async function restartProcess(pid: number): Promise<void> {
  return invoke("restart_process", { pid });
}

/**
 * Open a new Terminal.app window cd'd to the given path.
 */
export async function openInTerminal(path: string): Promise<void> {
  return invoke("open_in_terminal", { path });
}

/**
 * Open the given path in the user's preferred editor.
 * @param editor - CLI command, e.g. "code", "cursor"
 */
export async function openInEditor(
  path: string,
  editor: string
): Promise<void> {
  return invoke("open_in_editor", { path, editor });
}

/**
 * Open http://localhost:{port} in the default browser.
 */
export async function openInBrowser(port: number): Promise<void> {
  return invoke("open_in_browser", { port });
}

/**
 * Docker-specific stop (uses container ID, not PID).
 */
export async function stopDockerContainer(
  containerId: string
): Promise<void> {
  return invoke("stop_docker_container", { containerId });
}

/**
 * Docker-specific restart.
 */
export async function restartDockerContainer(
  containerId: string
): Promise<void> {
  return invoke("restart_docker_container", { containerId });
}

/**
 * Load persisted settings from Rust-side storage.
 */
export async function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

/**
 * Persist settings to Rust-side storage.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  return invoke("save_settings", { settings });
}

/**
 * Hide the main window (used when clicking outside or pressing Escape).
 */
export async function hideWindow(): Promise<void> {
  const window = getCurrentWindow();
  await window.hide();
}
