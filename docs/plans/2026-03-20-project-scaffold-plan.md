# localhost — Project Scaffold Plan

**Date:** 2026-03-20
**Based on:** voice-prompt reference project + localhost design doc

---

## Prerequisites

Verify these are installed before starting:

```bash
# Check Rust toolchain
rustc --version          # need 1.77+
cargo --version

# Check Node / pnpm
node --version           # need 20+
pnpm --version           # need 9+

# Check Tauri CLI (global or via pnpm dlx)
pnpm tauri --version     # need 2.x

# Check Xcode CLI tools (macOS)
xcode-select --version
```

---

## Phase 1 — Directory Bootstrap

```bash
# Step into the projects root
cd /Users/efecelik/Desktop/Projects

# Create the directory (design doc already placed docs/plans/ inside it)
mkdir -p localhost

cd localhost

# Create all directories up front so nothing is missing when pasting files
mkdir -p src/components
mkdir -p src/stores
mkdir -p src/hooks
mkdir -p src/lib
mkdir -p src/types
mkdir -p src/styles
mkdir -p src-tauri/src/scanner
mkdir -p src-tauri/capabilities
mkdir -p src-tauri/icons/macos
mkdir -p src-tauri/icons/shared
mkdir -p src-tauri/icons/windows
mkdir -p .github/workflows
mkdir -p scripts
mkdir -p docs/plans
```

---

## Phase 2 — Init Tauri Project

Tauri 2.0's `create-tauri-app` scaffolds both the Rust side and the chosen frontend template in one command. We then replace every generated config with the exact content in this plan.

```bash
cd /Users/efecelik/Desktop/Projects/localhost

# Scaffold — React + TypeScript + pnpm
# Answer prompts: project name = localhost, identifier = com.efecelik.localhost,
#                 frontend = React, manager = pnpm, template = TypeScript
pnpm create tauri-app@latest . \
  --template react-ts \
  --manager pnpm \
  --identifier com.efecelik.localhost

# Install deps (create-tauri-app may already run this, run again to be sure)
pnpm install

# Add all runtime Node dependencies
pnpm add zustand@^5.0.0 @tauri-apps/api@^2.0.0 @tauri-apps/plugin-shell@^2.0.0 @tauri-apps/plugin-store@^2.4.1

# Add all dev dependencies
pnpm add -D tailwindcss@^3.4.0 autoprefixer@^10.4.20 postcss@^8.4.47 @types/node@^20.0.0

# Initialize Tailwind (creates tailwind.config.js + postcss.config.js stubs)
pnpm dlx tailwindcss init -p

# Verify Rust target for Apple Silicon
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin
```

After init, **replace every generated config file** with the exact contents below. Do NOT keep the generated versions.

---

## Phase 3 — File Contents (Copy-Pasteable)

### 3.1 `package.json`

```json
{
  "name": "localhost",
  "version": "0.1.0",
  "description": "macOS menu bar app that shows all running dev processes grouped by project",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:arm64": "tauri build --target aarch64-apple-darwin",
    "tauri:build:x64": "tauri build --target x86_64-apple-darwin",
    "lint": "tsc --noEmit",
    "icons": "pnpm tauri icon src-tauri/icons/icon-source.png"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "@tauri-apps/plugin-store": "^2.4.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

**Note on omitted packages vs voice-prompt:**
- No `@tauri-apps/plugin-global-shortcut` — not needed for this app
- No `@headlessui/react` — using plain Tailwind for the simple list UI; add later if you need accessible dropdowns in settings
- No `sharp` — add only when running the icon generation script

---

### 3.2 `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri requires clearScreen: false to see Rust compile output
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Avoid triggering Vite restarts when Rust rebuilds
      ignored: ['**/src-tauri/**'],
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-state': ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'],
  },
});
```

---

### 3.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3.4 `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

---

### 3.5 `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm neutral palette — mirrors voice-prompt's surface scale
        surface: {
          50:  '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
          950: '#0C0A09',
        },
        // Port badge accent — cool blue-green to make port numbers pop
        port: {
          light: '#A7C4BC',
          DEFAULT: '#6FA3A0',
          dark: '#4A7F7C',
        },
        // Process status colours
        status: {
          healthy:     '#7C9A82',  // sage green
          high_cpu:    '#C9A962',  // warm amber
          high_memory: '#C9A962',  // warm amber
          crashed:     '#B87A7A',  // dusty rose
        },
        // Docker badge
        docker: {
          light: '#93B4D4',
          DEFAULT: '#6B99BF',
          dark:  '#4D7AA3',
        },
      },
      fontFamily: {
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        // Compact sizes for dense menu bar UI
        '2xs': ['10px', { lineHeight: '14px' }],
        'xs':  ['11px', { lineHeight: '16px' }],
        'sm':  ['12px', { lineHeight: '18px' }],
        'base':['13px', { lineHeight: '20px' }],
      },
      width: {
        'popup': '360px',
      },
      maxHeight: {
        'popup': '500px',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-down': 'slide-down 0.15s ease-out',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.6' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'popup':   '0 8px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
        'soft-sm': '0 1px 2px rgba(28, 25, 23, 0.04)',
        'soft-md': '0 4px 6px -1px rgba(28, 25, 23, 0.06), 0 2px 4px -1px rgba(28, 25, 23, 0.04)',
      },
    },
  },
  plugins: [],
};
```

---

### 3.6 `postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

### 3.7 `src-tauri/tauri.conf.json`

Key decisions vs voice-prompt:
- `decorations: false` — frameless window for a native popup feel
- `alwaysOnTop: true` — popup must appear over all windows, exactly like Spotlight / 1Password
- `transparent: true` — allows rounded corners with a drop shadow via CSS
- `skipTaskbar: true` — menu bar apps must not appear in the Dock
- Height starts at 500px; the Rust backend will resize the window dynamically after each scan

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "localhost",
  "version": "0.1.0",
  "identifier": "com.efecelik.localhost",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "localhost",
        "label": "main",
        "width": 360,
        "height": 500,
        "minWidth": 360,
        "maxWidth": 360,
        "resizable": false,
        "decorations": false,
        "transparent": true,
        "visible": false,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "shadow": false,
        "center": false
      }
    ],
    "trayIcon": {
      "id": "main-tray",
      "iconPath": "icons/tray-icon.png",
      "iconAsTemplate": true,
      "tooltip": "localhost — dev process monitor"
    },
    "security": {
      "csp": null
    },
    "macOSPrivateApi": true
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/shared/32x32.png",
      "icons/shared/128x128.png",
      "icons/shared/128x128@2x.png",
      "icons/shared/256x256.png",
      "icons/shared/512x512.png",
      "icons/shared/icon.png",
      "icons/macos/icon.icns",
      "icons/windows/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "13.0",
      "entitlements": "./entitlements.plist",
      "infoPlist": "./Info.plist",
      "signingIdentity": null,
      "dmg": {
        "appPosition": { "x": 180, "y": 170 },
        "applicationFolderPosition": { "x": 480, "y": 170 }
      }
    },
    "windows": {
      "webviewInstallMode": {
        "type": "embedBootstrapper"
      },
      "nsis": {
        "installMode": "currentUser",
        "installerIcon": "./icons/windows/icon.ico",
        "displayLanguageSelector": false,
        "startMenuFolder": "localhost",
        "minimumWebview2Version": "110.0.1531.0"
      }
    }
  }
}
```

**Note on `minimumSystemVersion: "13.0"` (Ventura):** `sysinfo` crate's process `cwd` reading requires system APIs present since macOS 12.3. Setting to 13.0 ensures a reliable baseline. Adjust to "12.0" if you need Monterey support and test carefully.

---

### 3.8 `src-tauri/capabilities/default.json`

Tauri 2.0 uses a capability-based permission model. Every allowed Tauri API must be listed here.

```json
{
  "$schema": "https://schemas.tauri.app/capabilities/schema.json",
  "identifier": "default",
  "description": "Default capabilities for localhost app",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-is-visible",
    "core:window:allow-set-focus",
    "core:window:allow-close",
    "core:clipboard:allow-write-text",
    "shell:allow-open",
    "store:default"
  ]
}
```

**Permission rationale:**
- `core:window:allow-set-size` — dynamic height resize after each scan
- `core:window:allow-set-position` — position popup below tray icon
- `core:window:allow-show` / `allow-hide` — toggle on tray click
- `core:clipboard:allow-write-text` — "Copy port" and "Copy path" actions
- `shell:allow-open` — open browser, terminal, VS Code/Cursor
- `store:default` — persist settings across launches

---

### 3.9 `src-tauri/Cargo.toml`

```toml
[package]
name = "localhost"
version = "0.1.0"
description = "macOS menu bar app for monitoring local dev processes"
authors = ["Efe Celik"]
edition = "2021"
rust-version = "1.77"

[lib]
name = "localhost_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
# Tauri core — tray-icon feature required for menu bar app
tauri = { version = "2", features = ["tray-icon", "image-png"] }

# Tauri plugins
tauri-plugin-shell  = "2"
tauri-plugin-store  = "2"

# Serialization
serde      = { version = "1", features = ["derive"] }
serde_json = "1"

# Async runtime — bollard and tokio-based code requires this
tokio = { version = "1", features = ["full"] }

# Process + system info scanning
sysinfo = { version = "0.31", features = ["system"] }

# Docker container scanning via Unix socket
bollard = { version = "0.17", default-features = false, features = ["unix-socket"] }

# Error handling
anyhow     = "1"
thiserror  = "1"

# Async trait support (needed when implementing async traits)
async-trait = "0.1"

# Logging
log         = "0.4"
env_logger  = "0.11"

[target.'cfg(target_os = "macos")'.dependencies]
# Raw Objective-C access for tray icon positioning and window behaviour
cocoa = "0.26"
objc  = "0.2"

[profile.dev]
# Faster incremental dev builds — don't strip debug info
opt-level = 0

[profile.release]
panic         = "abort"
codegen-units = 1
lto           = true
opt-level     = "s"
strip         = true
```

**Key crate decisions:**
- `sysinfo = "0.31"` — latest API that exposes `Process::cwd()`, CPU, memory. Earlier versions have a different API surface.
- `bollard = "0.17"` with `unix-socket` only — avoids pulling in TLS dependencies since we only talk to `/var/run/docker.sock`. Gracefully fails when Docker is not running.
- `tokio = { features = ["full"] }` — Tauri 2's async runtime is tokio; `bollard` is fully async so full feature set is the simplest choice.
- No `cocoa`/`objc` on non-macOS — kept behind `cfg` gate exactly like voice-prompt.

---

### 3.10 `src-tauri/entitlements.plist`

localhost needs network access (for Docker socket HTTP over Unix domain socket treated as local network) but NOT microphone access. It needs to read process information which does NOT require a special entitlement — the process table is world-readable by the running user.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Required to talk to Docker's Unix socket and open browser URLs -->
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- Allows reading process working directories via proc_pidinfo -->
    <!-- No special entitlement needed — user-space APIs are sufficient -->
    <!-- for processes owned by the current user -->

    <!-- Required for sandbox compatibility when opening Terminal / editors -->
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

---

### 3.11 `src-tauri/Info.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App display name in About dialog -->
    <key>CFBundleName</key>
    <string>localhost</string>

    <!-- Hides the app from the Dock — LSUIElement is the standard macOS -->
    <!-- way to declare a "background" / menu bar-only app -->
    <key>LSUIElement</key>
    <true/>

    <!-- Prevents the app from appearing in the App Switcher (Cmd+Tab) -->
    <key>LSBackgroundOnly</key>
    <false/>

    <!-- macOS uses this to show the usage reason if the user ever opens -->
    <!-- System Preferences > Security. Required when using apple-events. -->
    <key>NSAppleEventsUsageDescription</key>
    <string>localhost uses Apple Events to open Terminal and editors at project paths.</string>

    <!-- Required for macOS 14+ to read /proc-equivalent info -->
    <!-- via sysinfo without triggering TCC prompts -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <false/>
</dict>
</plist>
```

**Critical — `LSUIElement = true`:** This is what makes the app a true menu bar app with no Dock icon. Without this the window would appear in the Dock. Tauri 2.0 does not set this automatically even with `skipTaskbar: true` in the window config — it must be in Info.plist.

---

### 3.12 Root `index.html`

Replace the generated `index.html` at the project root (Vite serves from here):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>localhost</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### 3.13 `src/styles/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Remove default body margin/padding for popup window */
@layer base {
  * {
    box-sizing: border-box;
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  body {
    /* Transparent background for the popup window */
    background: transparent;
    /* Disable text selection in the UI (feels like a native app) */
    user-select: none;
    -webkit-user-select: none;
  }

  /* Re-enable selection only in copyable values */
  .selectable {
    user-select: text;
    -webkit-user-select: text;
  }

  /* Native-feeling scrollbar for the process list */
  ::-webkit-scrollbar {
    width: 4px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(120, 113, 108, 0.3);
    border-radius: 2px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(120, 113, 108, 0.5);
  }
}

@layer utilities {
  /* Tauri transparent window — the popup card sits inside this */
  .popup-window {
    @apply w-popup rounded-xl overflow-hidden;
    background: transparent;
  }

  /* The visible card */
  .popup-card {
    @apply bg-surface-100 dark:bg-surface-900 rounded-xl shadow-popup;
    @apply border border-surface-200 dark:border-surface-700;
  }

  /* Monospace port badge */
  .port-badge {
    @apply font-mono text-xs px-1.5 py-0.5 rounded;
    @apply bg-port-light/20 text-port-dark;
    @apply dark:bg-port-dark/20 dark:text-port-light;
  }

  /* Process row hover */
  .process-row {
    @apply flex items-center gap-2 px-3 py-1.5 rounded-lg;
    @apply hover:bg-surface-200/60 dark:hover:bg-surface-700/60;
    @apply transition-colors duration-100 cursor-default;
  }
}
```

---

### 3.14 `src/types/index.ts`

```typescript
// Direct copy of the data model from the design doc.
// Keep this file as the single source of truth for all types.
// The Rust structs in src-tauri/src/types.rs must mirror these exactly.

export type ProcessSource = 'port_scan' | 'dev_tool' | 'docker';

export type ProcessStatus = 'healthy' | 'high_cpu' | 'high_memory' | 'crashed';

export interface DockerInfo {
  containerId: string;
  containerName: string;
  image: string;
  status: string;
}

export interface Process {
  pid: number;
  name: string;            // e.g. "node", "postgres"
  port: number | null;     // e.g. 3000, null if no port
  relativePath: string;    // e.g. "/apps/web"
  fullPath: string;        // e.g. "/Users/efe/Desktop/Projects/agent-attack/apps/web"
  uptime: number;          // seconds since process start
  cpuPercent: number;
  memoryMb: number;
  status: ProcessStatus;
  source: ProcessSource;
  dockerInfo?: DockerInfo;
}

export interface ProjectGroup {
  name: string;            // e.g. "agent-attack"
  path: string;            // e.g. "/Users/efe/Desktop/Projects/agent-attack"
  processes: Process[];
}

export interface Settings {
  scanInterval: number;    // ms, default 5000
  projectsDir: string;     // default: ~/Desktop/Projects
  theme: 'system' | 'light' | 'dark';
  editorCommand: string;   // 'code' | 'cursor' | custom
}

export interface AppState {
  projects: ProjectGroup[];
  lastUpdated: number;     // unix timestamp ms
  isScanning: boolean;
  error: string | null;
  settings: Settings;
}

// Tauri command return type
export interface ScanResult {
  projects: ProjectGroup[];
  scannedAt: number;
}
```

---

### 3.15 `src/stores/processStore.ts`

```typescript
import { create } from 'zustand';
import type { AppState, ProjectGroup, Settings } from '@/types';

const DEFAULT_SETTINGS: Settings = {
  scanInterval: 5000,
  projectsDir: '',          // populated from Rust on first load
  theme: 'system',
  editorCommand: 'cursor',
};

interface ProcessStore extends AppState {
  // Actions
  setProjects: (projects: ProjectGroup[]) => void;
  setScanning: (isScanning: boolean) => void;
  setError: (error: string | null) => void;
  setSettings: (settings: Partial<Settings>) => void;
  markUpdated: () => void;
}

export const useProcessStore = create<ProcessStore>()((set) => ({
  // Initial state
  projects: [],
  lastUpdated: 0,
  isScanning: false,
  error: null,
  settings: DEFAULT_SETTINGS,

  // Actions
  setProjects: (projects) =>
    set({ projects, error: null }),

  setScanning: (isScanning) =>
    set({ isScanning }),

  setError: (error) =>
    set({ error, isScanning: false }),

  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  markUpdated: () =>
    set({ lastUpdated: Date.now() }),
}));

// Derived selectors (call inside components)
export const selectTotalProcessCount = (state: ProcessStore) =>
  state.projects.reduce((sum, p) => sum + p.processes.length, 0);

export const selectProjectCount = (state: ProcessStore) =>
  state.projects.length;
```

---

### 3.16 `src/lib/tauri.ts`

Typed wrappers around every `tauri::command`. All backend communication goes through this file — never call `invoke` directly from components.

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { ProjectGroup, Settings } from '@/types';

// ── Process scanning ──────────────────────────────────────────────────────

export async function getProcesses(projectsDir: string): Promise<ProjectGroup[]> {
  return invoke<ProjectGroup[]>('get_processes', { projectsDir });
}

export async function stopProcess(pid: number): Promise<void> {
  return invoke<void>('stop_process', { pid });
}

export async function restartProcess(pid: number): Promise<void> {
  return invoke<void>('restart_process', { pid });
}

// ── Quick actions ─────────────────────────────────────────────────────────

export async function openInTerminal(path: string): Promise<void> {
  return invoke<void>('open_in_terminal', { path });
}

export async function openInEditor(path: string, editor: string): Promise<void> {
  return invoke<void>('open_in_editor', { path, editor });
}

export async function openInBrowser(port: number): Promise<void> {
  return invoke<void>('open_in_browser', { port });
}

// ── Docker actions ────────────────────────────────────────────────────────

export async function stopDockerContainer(containerId: string): Promise<void> {
  return invoke<void>('stop_docker_container', { containerId });
}

export async function restartDockerContainer(containerId: string): Promise<void> {
  return invoke<void>('restart_docker_container', { containerId });
}

// ── Settings ──────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  return invoke<Settings>('get_settings');
}

export async function saveSettings(settings: Settings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

// ── Window control (called from tray logic in Rust, but also usable from TS) ─

export async function hideWindow(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().hide();
}
```

---

### 3.17 `src/hooks/useProcessPoller.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { getProcesses } from '@/lib/tauri';
import { useProcessStore } from '@/stores/processStore';

export function useProcessPoller() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { settings, setProjects, setScanning, setError, markUpdated } = useProcessStore();

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const projects = await getProcesses(settings.projectsDir);
      setProjects(projects);
      markUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, [settings.projectsDir, setProjects, setScanning, setError, markUpdated]);

  // Start polling when the hook mounts; restart when interval setting changes
  useEffect(() => {
    // Immediate first scan
    scan();

    intervalRef.current = setInterval(scan, settings.scanInterval);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [scan, settings.scanInterval]);

  // Expose manual refresh trigger
  return { refresh: scan };
}
```

---

### 3.18 `src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

---

### 3.19 `src/App.tsx`

```typescript
import { useEffect } from 'react';
import { useProcessStore } from '@/stores/processStore';
import { getSettings } from '@/lib/tauri';
import MenuDropdown from '@/components/MenuDropdown';

export default function App() {
  const setSettings = useProcessStore((s) => s.setSettings);

  // Load persisted settings from Rust/store on mount
  useEffect(() => {
    getSettings()
      .then((settings) => setSettings(settings))
      .catch(console.error);
  }, [setSettings]);

  // Theme application
  const theme = useProcessStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // 'system' — follow OS preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      root.classList.toggle('dark', mq.matches);
      const handler = (e: MediaQueryListEvent) => root.classList.toggle('dark', e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  return (
    <div className="popup-window animate-fade-in">
      <MenuDropdown />
    </div>
  );
}
```

---

### 3.20 `src/components/MenuDropdown.tsx` (stub)

```typescript
import { useProcessPoller } from '@/hooks/useProcessPoller';
import { useProcessStore, selectTotalProcessCount, selectProjectCount } from '@/stores/processStore';
import Header from './Header';
import ProjectList from './ProjectList';
import Footer from './Footer';
import EmptyState from './EmptyState';

export default function MenuDropdown() {
  const { refresh } = useProcessPoller();
  const projects = useProcessStore((s) => s.projects);
  const totalProcesses = useProcessStore(selectTotalProcessCount);
  const projectCount = useProcessStore(selectProjectCount);

  return (
    <div className="popup-card flex flex-col w-popup max-h-popup">
      <Header onRefresh={refresh} />
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ProjectList projects={projects} />
        )}
      </div>
      <Footer processCount={totalProcesses} projectCount={projectCount} />
    </div>
  );
}
```

---

### 3.21 Remaining Component Stubs

Create each file with a minimal implementation. These will be fleshed out in the implementation phase.

**`src/components/Header.tsx`**
```typescript
interface HeaderProps {
  onRefresh: () => void;
}
export default function Header({ onRefresh }: HeaderProps) {
  const isScanning = /* useProcessStore */ false;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
      <span className="text-sm font-semibold text-surface-800 dark:text-surface-100">
        localhost
      </span>
      <button
        onClick={onRefresh}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        title="Refresh"
      >
        {/* SVG refresh icon here */}
        <svg className={`w-3.5 h-3.5 text-surface-500 ${isScanning ? 'animate-spin-slow' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
```

**`src/components/Footer.tsx`**
```typescript
interface FooterProps {
  processCount: number;
  projectCount: number;
}
export default function Footer({ processCount, projectCount }: FooterProps) {
  return (
    <div className="px-4 py-2 border-t border-surface-200 dark:border-surface-700">
      <span className="text-2xs text-surface-400 dark:text-surface-500">
        {processCount} {processCount === 1 ? 'process' : 'processes'} — {projectCount} {projectCount === 1 ? 'project' : 'projects'}
      </span>
    </div>
  );
}
```

**`src/components/EmptyState.tsx`**
```typescript
export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
      <span className="text-2xl">://</span>
      <p className="text-sm text-surface-400 dark:text-surface-500 text-center">
        No active processes
      </p>
      <p className="text-xs text-surface-300 dark:text-surface-600 text-center">
        Start a dev server and it will appear here automatically.
      </p>
    </div>
  );
}
```

**`src/components/ProjectList.tsx`**
```typescript
import type { ProjectGroup as ProjectGroupType } from '@/types';
import ProjectGroupComponent from './ProjectGroup';

interface ProjectListProps {
  projects: ProjectGroupType[];
}
export default function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="py-1">
      {projects.map((group) => (
        <ProjectGroupComponent key={group.path} group={group} />
      ))}
    </div>
  );
}
```

**`src/components/ProjectGroup.tsx`**
```typescript
import type { ProjectGroup } from '@/types';
import ProcessItem from './ProcessItem';

interface ProjectGroupProps {
  group: ProjectGroup;
}
export default function ProjectGroupComponent({ group }: ProjectGroupProps) {
  return (
    <div className="mb-1">
      <div className="px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
        {group.name}
      </div>
      {group.processes.map((process) => (
        <ProcessItem key={`${process.pid}-${process.port}`} process={process} />
      ))}
    </div>
  );
}
```

**`src/components/ProcessItem.tsx`** (stub — detail panel wiring comes in implementation phase)
```typescript
import { useState } from 'react';
import type { Process } from '@/types';
import PortBadge from './PortBadge';
import DetailPanel from './DetailPanel';

interface ProcessItemProps {
  process: Process;
}
export default function ProcessItem({ process }: ProcessItemProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <div className="process-row group">
        <PortBadge port={process.port} source={process.source} />
        <span className="flex-1 text-xs text-surface-600 dark:text-surface-300 truncate font-mono">
          {process.relativePath || process.name}
        </span>
        <button
          onClick={() => setShowDetail(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 px-1"
          title="Details"
        >
          i
        </button>
      </div>
      {showDetail && (
        <DetailPanel process={process} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}
```

**`src/components/PortBadge.tsx`**
```typescript
import type { ProcessSource } from '@/types';

interface PortBadgeProps {
  port: number | null;
  source: ProcessSource;
}
export default function PortBadge({ port, source }: PortBadgeProps) {
  if (port === null) {
    return (
      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-200/60 dark:bg-surface-700/60 text-surface-400 w-16 text-center">
        {source === 'docker' ? 'docker' : '—'}
      </span>
    );
  }
  return (
    <span className="port-badge w-16 text-center">
      :{port}
    </span>
  );
}
```

**`src/components/DetailPanel.tsx`** (stub)
```typescript
import type { Process } from '@/types';
import ActionButtons from './ActionButtons';

interface DetailPanelProps {
  process: Process;
  onClose: () => void;
}
export default function DetailPanel({ process, onClose }: DetailPanelProps) {
  const uptimeStr = formatUptime(process.uptime);
  return (
    <div className="mx-2 mb-1 p-3 rounded-lg bg-surface-200/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 animate-slide-down">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-surface-700 dark:text-surface-200">{process.name}</span>
        <button onClick={onClose} className="text-xs text-surface-400 hover:text-surface-600">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-2xs text-surface-500 dark:text-surface-400">
        <span>PID: {process.pid}</span>
        <span>Uptime: {uptimeStr}</span>
        <span>CPU: {process.cpuPercent.toFixed(1)}%</span>
        <span>Memory: {process.memoryMb} MB</span>
      </div>
      <ActionButtons process={process} />
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
```

**`src/components/ActionButtons.tsx`** (stub)
```typescript
import type { Process } from '@/types';
import {
  stopProcess, restartProcess, openInTerminal,
  openInEditor, openInBrowser,
  stopDockerContainer, restartDockerContainer,
} from '@/lib/tauri';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useProcessStore } from '@/stores/processStore';

interface ActionButtonsProps {
  process: Process;
}
export default function ActionButtons({ process: proc }: ActionButtonsProps) {
  const editorCommand = useProcessStore((s) => s.settings.editorCommand);

  return (
    <div className="flex flex-wrap gap-1">
      {proc.source === 'docker' && proc.dockerInfo ? (
        <>
          <ActionBtn label="Stop" onClick={() => stopDockerContainer(proc.dockerInfo!.containerId)} />
          <ActionBtn label="Restart" onClick={() => restartDockerContainer(proc.dockerInfo!.containerId)} />
        </>
      ) : (
        <>
          <ActionBtn label="Stop" onClick={() => stopProcess(proc.pid)} />
          <ActionBtn label="Restart" onClick={() => restartProcess(proc.pid)} />
        </>
      )}
      <ActionBtn label="Terminal" onClick={() => openInTerminal(proc.fullPath)} />
      <ActionBtn label="Editor" onClick={() => openInEditor(proc.fullPath, editorCommand)} />
      {proc.port !== null && (
        <ActionBtn label="Browser" onClick={() => openInBrowser(proc.port!)} />
      )}
      {proc.port !== null && (
        <ActionBtn label="Copy :port" onClick={() => writeText(String(proc.port))} />
      )}
      <ActionBtn label="Copy path" onClick={() => writeText(proc.fullPath)} />
    </div>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 text-2xs rounded bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 transition-colors"
    >
      {label}
    </button>
  );
}
```

**`src/components/Settings.tsx`** (stub — lazy-loaded, not wired to routing yet)
```typescript
import { useState } from 'react';
import { useProcessStore } from '@/stores/processStore';
import { saveSettings } from '@/lib/tauri';

export default function Settings() {
  const settings = useProcessStore((s) => s.settings);
  const setSettings = useProcessStore((s) => s.setSettings);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-100">Settings</h2>
      {/* Fields wired in implementation phase */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-3 py-1.5 text-xs bg-surface-800 dark:bg-surface-200 text-surface-100 dark:text-surface-800 rounded hover:opacity-90 transition-opacity"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
```

---

### 3.22 Rust Backend Stubs

#### `src-tauri/src/types.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub port: Option<u16>,
    pub cwd: String,
    pub relative_path: String,
    pub uptime_secs: u64,
    pub cpu_percent: f32,
    pub memory_mb: u64,
    pub source: String,           // "port_scan" | "dev_tool" | "docker"
    pub docker_info: Option<DockerContainerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainerInfo {
    pub container_id: String,
    pub container_name: String,
    pub image: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGroup {
    pub name: String,
    pub path: String,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub scan_interval: u64,       // ms
    pub projects_dir: String,
    pub theme: String,            // "system" | "light" | "dark"
    pub editor_command: String,   // "code" | "cursor"
}

impl Default for Settings {
    fn default() -> Self {
        let home = dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        Self {
            scan_interval: 5000,
            projects_dir: format!("{home}/Desktop/Projects"),
            theme: "system".to_string(),
            editor_command: "cursor".to_string(),
        }
    }
}
```

**Note:** Add `dirs = "5"` to Cargo.toml under `[dependencies]` for the `dirs::home_dir()` call.

#### `src-tauri/src/commands.rs`

```rust
use tauri::State;
use crate::types::{ProjectGroup, Settings};
use crate::scanner;

#[tauri::command]
pub async fn get_processes(projects_dir: String) -> Result<Vec<ProjectGroup>, String> {
    scanner::scan_all(&projects_dir).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_process(pid: u32) -> Result<(), String> {
    use std::process::Command;
    Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn restart_process(_pid: u32) -> Result<(), String> {
    // Phase 2 implementation — process restart requires capturing the original
    // argv + cwd, stopping the old process, and re-spawning. Placeholder for now.
    Err("Restart not yet implemented".to_string())
}

#[tauri::command]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    use std::process::Command;
    // Opens a new Terminal.app window cd'd into path
    let script = format!(
        r#"tell application "Terminal" to do script "cd \"{path}\"" activate"#
    );
    Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_in_editor(path: String, editor: String) -> Result<(), String> {
    use std::process::Command;
    Command::new(&editor)
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open editor '{editor}': {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn open_in_browser(port: u16) -> Result<(), String> {
    let url = format!("http://localhost:{port}");
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_docker_container(container_id: String) -> Result<(), String> {
    use std::process::Command;
    Command::new("docker")
        .args(["stop", &container_id])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn restart_docker_container(container_id: String) -> Result<(), String> {
    use std::process::Command;
    Command::new("docker")
        .args(["restart", &container_id])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_settings(
    store: State<'_, tauri_plugin_store::Store<tauri::Wry>>,
) -> Result<Settings, String> {
    // Return stored settings or defaults
    let settings: Settings = store
        .get("settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    Ok(settings)
}

#[tauri::command]
pub async fn save_settings(
    settings: Settings,
    store: State<'_, tauri_plugin_store::Store<tauri::Wry>>,
) -> Result<(), String> {
    store
        .set("settings", serde_json::to_value(&settings).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())
}
```

**Note:** Add `open = "5"` to Cargo.toml for `open::that()`. Also add `dirs = "5"` as noted above.

Updated `[dependencies]` block for Cargo.toml:
```toml
open = "5"
dirs = "5"
```

#### `src-tauri/src/scanner/mod.rs`

```rust
use anyhow::Result;
use crate::types::ProjectGroup;

pub mod port_scanner;
pub mod dev_tools;
pub mod docker;

use crate::project_resolver::ProjectResolver;

pub async fn scan_all(projects_dir: &str) -> Result<Vec<ProjectGroup>> {
    let resolver = ProjectResolver::new(projects_dir);

    // Run all three scanners concurrently
    let (port_procs, dev_procs, docker_procs) = tokio::join!(
        port_scanner::scan(),
        dev_tools::scan(),
        docker::scan(),
    );

    // Merge and deduplicate by PID (port_scan wins over dev_tool for same PID)
    let mut all_processes = Vec::new();

    if let Ok(procs) = port_procs { all_processes.extend(procs); }
    if let Ok(procs) = dev_procs  { all_processes.extend(procs); }
    if let Ok(procs) = docker_procs { all_processes.extend(procs); }

    // Dedup: keep first occurrence per PID
    let mut seen_pids = std::collections::HashSet::new();
    all_processes.retain(|p| {
        if p.source == "docker" { return true; } // Docker entries have no meaningful PID overlap
        seen_pids.insert(p.pid)
    });

    // Group into ProjectGroups
    let groups = resolver.group_processes(all_processes);

    Ok(groups)
}
```

#### `src-tauri/src/scanner/port_scanner.rs`

```rust
use anyhow::Result;
use sysinfo::{System, ProcessesToUpdate};
use crate::types::ProcessInfo;

pub async fn scan() -> Result<Vec<ProcessInfo>> {
    // sysinfo is synchronous — run on blocking thread pool to avoid blocking tokio
    tokio::task::spawn_blocking(|| {
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::All, true);

        let start_time = System::boot_time();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut results = Vec::new();

        for (pid, process) in sys.processes() {
            let cwd = process.cwd()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            // Skip processes without a cwd (kernel threads, system processes)
            if cwd.is_empty() { continue; }

            // Check if process has any listening TCP ports
            // sysinfo 0.31 exposes this via networks — we use a direct approach:
            // parse /proc/net/tcp (Linux) or use platform API (macOS via lsof-free approach)
            // For the scaffold, stub with empty port — full implementation in Phase 2
            let port: Option<u16> = None; // TODO: implement port detection

            let uptime_secs = now.saturating_sub(process.start_time());
            let memory_mb = process.memory() / (1024 * 1024);

            results.push(ProcessInfo {
                pid: pid.as_u32(),
                name: process.name().to_string_lossy().to_string(),
                port,
                cwd: cwd.clone(),
                relative_path: String::new(), // filled by project_resolver
                uptime_secs,
                cpu_percent: process.cpu_usage(),
                memory_mb,
                source: "port_scan".to_string(),
                docker_info: None,
            });
        }

        Ok(results)
    })
    .await?
}
```

#### `src-tauri/src/scanner/dev_tools.rs`

```rust
use anyhow::Result;
use sysinfo::{System, ProcessesToUpdate};
use crate::types::ProcessInfo;

// Known dev process names to watch for even without a port
const DEV_TOOL_NAMES: &[&str] = &[
    // Node
    "node", "deno", "bun",
    // Python
    "python", "python3", "uvicorn", "gunicorn", "flask",
    // Go
    "go", "air",
    // Rust
    "cargo",
    // Ruby
    "ruby", "rails", "puma",
    // Java
    "java", "gradle", "mvn",
    // Databases
    "postgres", "mysql", "mongod", "redis-server",
    // Servers
    "nginx", "caddy", "httpd",
];

pub async fn scan() -> Result<Vec<ProcessInfo>> {
    tokio::task::spawn_blocking(|| {
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::All, true);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut results = Vec::new();

        for (pid, process) in sys.processes() {
            let name = process.name().to_string_lossy().to_lowercase();
            let is_dev_tool = DEV_TOOL_NAMES.iter().any(|&n| name.contains(n));
            if !is_dev_tool { continue; }

            let cwd = process.cwd()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            if cwd.is_empty() { continue; }

            let uptime_secs = now.saturating_sub(process.start_time());
            let memory_mb = process.memory() / (1024 * 1024);

            results.push(ProcessInfo {
                pid: pid.as_u32(),
                name: process.name().to_string_lossy().to_string(),
                port: None,
                cwd,
                relative_path: String::new(),
                uptime_secs,
                cpu_percent: process.cpu_usage(),
                memory_mb,
                source: "dev_tool".to_string(),
                docker_info: None,
            });
        }

        Ok(results)
    })
    .await?
}
```

#### `src-tauri/src/scanner/docker.rs`

```rust
use anyhow::Result;
use bollard::Docker;
use bollard::container::ListContainersOptions;
use std::collections::HashMap;
use crate::types::{ProcessInfo, DockerContainerInfo};

pub async fn scan() -> Result<Vec<ProcessInfo>> {
    // Connect to Docker socket — returns empty list if Docker is not running
    let docker = match Docker::connect_with_unix_defaults() {
        Ok(d) => d,
        Err(_) => return Ok(vec![]),
    };

    // Verify Docker is reachable
    if docker.ping().await.is_err() {
        return Ok(vec![]);
    }

    let options = ListContainersOptions::<String> {
        all: false, // running containers only
        ..Default::default()
    };

    let containers = docker.list_containers(Some(options)).await?;
    let mut results = Vec::new();

    for container in containers {
        let id = container.id.unwrap_or_default();
        let names = container.names.unwrap_or_default();
        let name = names.first()
            .map(|n| n.trim_start_matches('/').to_string())
            .unwrap_or_else(|| id[..12.min(id.len())].to_string());
        let image = container.image.unwrap_or_default();
        let status = container.status.unwrap_or_default();

        // Extract first exposed port
        let port: Option<u16> = container.ports
            .as_ref()
            .and_then(|ports| ports.first())
            .and_then(|p| p.public_port.map(|pp| pp as u16));

        // Resolve working directory via Docker Compose label
        let labels = container.labels.unwrap_or_default();
        let cwd = labels
            .get("com.docker.compose.project.working_dir")
            .cloned()
            .unwrap_or_default();

        // Uptime from created timestamp
        let created = container.created.unwrap_or(0);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let uptime_secs = (now - created).max(0) as u64;

        results.push(ProcessInfo {
            pid: 0,  // Docker containers don't have a meaningful host PID
            name: name.clone(),
            port,
            cwd: cwd.clone(),
            relative_path: String::new(),
            uptime_secs,
            cpu_percent: 0.0,  // Would require container stats API (expensive) — Phase 2
            memory_mb: 0,      // Same
            source: "docker".to_string(),
            docker_info: Some(DockerContainerInfo {
                container_id: id,
                container_name: name,
                image,
                status,
            }),
        });
    }

    Ok(results)
}
```

#### `src-tauri/src/project_resolver.rs`

```rust
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use crate::types::{ProcessInfo, ProjectGroup};

pub struct ProjectResolver {
    projects_dir: PathBuf,
}

// Files/dirs that mark the root of a project
const PROJECT_MARKERS: &[&str] = &[
    ".git",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "requirements.txt",
];

impl ProjectResolver {
    pub fn new(projects_dir: &str) -> Self {
        Self {
            projects_dir: PathBuf::from(shellexpand::tilde(projects_dir).as_ref()),
        }
    }

    /// Walk up from `cwd` looking for a project root marker.
    /// Returns the project root path if found.
    fn find_project_root(&self, cwd: &str) -> Option<PathBuf> {
        let start = Path::new(cwd);
        let mut current = start;

        loop {
            for marker in PROJECT_MARKERS {
                if current.join(marker).exists() {
                    return Some(current.to_path_buf());
                }
            }
            match current.parent() {
                Some(parent) if parent != current => current = parent,
                _ => break,
            }
        }
        None
    }

    /// Derive a display name from the project root path.
    fn project_name(&self, root: &Path) -> String {
        root.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    }

    /// Compute the path relative to the project root.
    fn relative_path(&self, cwd: &str, root: &Path) -> String {
        let cwd_path = Path::new(cwd);
        cwd_path.strip_prefix(root)
            .map(|r| {
                let s = r.to_string_lossy().to_string();
                if s.is_empty() { "/".to_string() } else { format!("/{s}") }
            })
            .unwrap_or_else(|_| cwd.to_string())
    }

    pub fn group_processes(&self, mut processes: Vec<ProcessInfo>) -> Vec<ProjectGroup> {
        let mut groups: HashMap<String, ProjectGroup> = HashMap::new();

        for proc in &mut processes {
            if proc.cwd.is_empty() {
                // No cwd — put in "Other"
                proc.relative_path = proc.name.clone();
                groups.entry("Other".to_string())
                    .or_insert_with(|| ProjectGroup {
                        name: "Other".to_string(),
                        path: String::new(),
                        processes: vec![],
                    })
                    .processes.push(proc.clone());
                continue;
            }

            let root = self.find_project_root(&proc.cwd)
                .unwrap_or_else(|| PathBuf::from(&proc.cwd));

            let name = self.project_name(&root);
            let path = root.to_string_lossy().to_string();

            proc.relative_path = self.relative_path(&proc.cwd, &root);

            groups.entry(name.clone())
                .or_insert_with(|| ProjectGroup { name, path, processes: vec![] })
                .processes.push(proc.clone());
        }

        // Sort: projects under the configured projects_dir first, then alphabetically
        let mut sorted: Vec<ProjectGroup> = groups.into_values().collect();
        sorted.sort_by(|a, b| {
            let a_primary = a.path.starts_with(self.projects_dir.to_string_lossy().as_ref());
            let b_primary = b.path.starts_with(self.projects_dir.to_string_lossy().as_ref());
            match (a_primary, b_primary) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });

        sorted
    }
}
```

**Note:** Add `shellexpand = "3"` to Cargo.toml dependencies for `~` expansion.

Updated final `[dependencies]` additions:
```toml
open        = "5"
dirs        = "5"
shellexpand = "3"
```

#### `src-tauri/src/lib.rs`

```rust
mod types;
mod commands;
mod scanner;
mod project_resolver;

use tauri::{
    Manager, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    WebviewWindowBuilder,
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Hide the default window until tray icon is clicked
            if let Some(window) = app.get_webview_window("main") {
                window.hide()?;
            }

            // Build tray icon
            let tray = TrayIconBuilder::new()
                .tooltip("localhost — dev process monitor")
                .icon(app.default_window_icon().unwrap().clone())
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        toggle_window(app);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_processes,
            commands::stop_process,
            commands::restart_process,
            commands::open_in_terminal,
            commands::open_in_editor,
            commands::open_in_browser,
            commands::stop_docker_container,
            commands::restart_docker_container,
            commands::get_settings,
            commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running localhost");
}

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            // TODO Phase 2: position window below tray icon using tray_rect
        }
    }
}
```

#### `src-tauri/src/main.rs`

```rust
// Prevents an extra console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    localhost_lib::run();
}
```

---

### 3.23 `.gitignore`

```gitignore
# Node
node_modules/
dist/
.pnpm-store/

# Tauri
src-tauri/target/
src-tauri/gen/

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.cursor/
*.swp
*.swo

# Build artifacts
*.dmg
*.app
*.exe
*.msi
```

---

### 3.24 `CLAUDE.md`

```markdown
# localhost — Project Instructions for AI Assistants

## Project Summary
macOS menu bar app that auto-detects running dev processes grouped by project.
Built with Tauri 2.0 + React 18 + TypeScript + Tailwind CSS + Zustand.

## Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, Zustand
- **Backend:** Rust (Tauri 2.0), sysinfo, bollard (Docker)
- **Build:** Vite, pnpm
- **Target:** macOS 13.0+ (primary), Windows (future)

## Package Manager
Always use **pnpm**. Never use npm or yarn.

## Key Conventions

### Frontend
- All Tauri `invoke` calls go through `src/lib/tauri.ts` — never call `invoke` directly in components
- State lives in `src/stores/processStore.ts` (Zustand) — single store, flat shape
- Path alias `@/` maps to `src/` — use it everywhere
- Component files: PascalCase.tsx, hook files: camelCase.ts, store files: camelCase.ts
- Tailwind only — no inline styles, no CSS modules, no emotion/styled-components

### Rust
- All Tauri commands are defined in `src-tauri/src/commands.rs` and registered in `lib.rs`
- Types shared between Rust and TypeScript: `src-tauri/src/types.rs` (Rust) mirrors `src/types/index.ts` (TS)
- serde field naming: use `#[serde(rename_all = "camelCase")]` on all structs so JSON matches TS camelCase
- Three scanner modules under `src-tauri/src/scanner/`: `port_scanner`, `dev_tools`, `docker`
- `ProjectResolver` in `project_resolver.rs` does all cwd → project mapping

### Git
- NEVER add Co-Authored-By lines to commit messages
- Commit format: `type(scope): message` — e.g. `feat(scanner): add port detection`
- Types: feat, fix, refactor, docs, chore, test

## Development Commands
```bash
pnpm tauri:dev        # Start dev server + Tauri hot reload
pnpm tauri:build      # Production build (universal binary)
pnpm tauri:build:arm64   # Apple Silicon only
pnpm tauri:build:x64     # Intel only
pnpm lint             # TypeScript type check
```

## Architecture Decisions
1. **Zustand over Jotai/Redux:** Single flat process list, no deeply nested state. Zustand is zero-boilerplate.
2. **sysinfo over shelling out to `ps`/`lsof`:** Native Rust crate, faster, no subprocess overhead, cross-platform.
3. **bollard over shelling out to `docker`:** Async Rust Docker client, no PATH dependency, handles Docker-not-running gracefully.
4. **Frameless + transparent window:** Looks like a native macOS popup (similar to 1Password mini, Raycast). `LSUIElement=true` in Info.plist removes Dock icon.
5. **5-second polling:** Simple and predictable. No file watchers or push mechanisms to maintain.

## Files to Know
- `src/types/index.ts` — canonical data model (TypeScript)
- `src-tauri/src/types.rs` — must mirror the above (Rust)
- `src/lib/tauri.ts` — all backend communication
- `src/stores/processStore.ts` — all frontend state
- `src/hooks/useProcessPoller.ts` — polling loop
- `src-tauri/src/scanner/mod.rs` — scanner orchestration
- `src-tauri/src/project_resolver.rs` — cwd → project grouping
```

---

## Phase 4 — GitHub Actions Workflows

### `.github/workflows/release-macos.yml`

```yaml
name: Release macOS

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - target: aarch64-apple-darwin
            runner: macos-14          # M1/M2 runner
          - target: x86_64-apple-darwin
            runner: macos-13          # Intel runner

    runs-on: ${{ matrix.runner }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install Node deps
        run: pnpm install

      - name: Build Tauri app
        run: pnpm tauri build --target ${{ matrix.target }}

      - name: Upload DMG
        uses: softprops/action-gh-release@v2
        with:
          files: |
            src-tauri/target/${{ matrix.target }}/release/bundle/dmg/*.dmg
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### `.github/workflows/update-homebrew.yml`

```yaml
name: Update Homebrew Tap

on:
  release:
    types: [published]

jobs:
  update-tap:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger tap update
        env:
          TAP_TOKEN: ${{ secrets.TAP_GITHUB_TOKEN }}
        run: |
          curl -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $TAP_TOKEN" \
            https://api.github.com/repos/efeecllk/homebrew-localhost/dispatches \
            -d '{"event_type":"new-release","client_payload":{"tag":"${{ github.ref_name }}"}}'
```

---

## Phase 5 — Git Initialization

```bash
cd /Users/efecelik/Desktop/Projects/localhost

git init
git add .
git commit -m "chore(scaffold): initial project setup

Tauri 2.0 + React 18 + TypeScript + Tailwind CSS + Zustand.
All config files, type stubs, component stubs, and Rust backend
modules scaffolded per design doc 2026-03-20-localhost-design.md."
```

---

## Phase 6 — First Run Verification

```bash
cd /Users/efecelik/Desktop/Projects/localhost

# Verify pnpm lockfile and node_modules are present
pnpm install

# Type-check the frontend
pnpm lint

# Verify Rust compiles (no link errors)
cd src-tauri && cargo check && cd ..

# Start the dev environment
pnpm tauri:dev
```

Expected results:
- Vite dev server starts on port 1420
- Tauri window appears (initially visible in dev mode for easy inspection)
- Tray icon appears in the macOS menu bar showing `://`
- Console shows no TypeScript errors
- Rust compiles without errors (scanner stubs return empty lists, which is correct)
- Frontend shows EmptyState component ("No active processes")

---

## Critical Details & Known Gotchas

### macOS Process `cwd` Reading

`sysinfo` reads process `cwd` via `proc_pidinfo(PROC_PIDVNODEPATHINFO)` on macOS. This works without special entitlements for processes owned by the current user. Processes owned by root (e.g., system `postgres`, `nginx`) will return an empty `cwd` — they will still appear under "Other" or be skipped.

### Port Detection Gap in Scaffold

`port_scanner.rs` currently stubs `port: None`. The production implementation requires reading the macOS network socket table. The recommended approach is to use `libproc` or shell out to `lsof -iTCP -sTCP:LISTEN -P -n` once at startup then parse the output. The bollard/docker scanner already handles Docker ports correctly.

### `bollard` Graceful Degradation

`docker::scan()` returns `Ok(vec![])` if Docker is not running. Never panic or return `Err` when Docker is absent — it is a normal state. The UI shows zero Docker containers, which is correct.

### `LSUIElement` + Tauri Window Visibility

In development (`tauri:dev`), the window will be visible by default so you can inspect the UI. In production the window starts hidden and only appears on tray click. If you need to debug the hidden-window flow during dev, temporarily add `"visible": true` to `tauri.conf.json` and revert before committing.

### Window Positioning (Phase 2)

The `toggle_window` function in `lib.rs` currently centers the window. The Phase 2 task is to query the tray icon's screen rect via `TrayIcon::rect()` and position the window directly below it, matching macOS convention. This requires macOS-specific Objective-C code (similar to voice-prompt's cocoa usage).

### `@tauri-apps/plugin-clipboard-manager`

`ActionButtons.tsx` imports `writeText` from `@tauri-apps/plugin-clipboard-manager`. This package is not in the `package.json` above because `core:clipboard:allow-write-text` in `capabilities/default.json` exposes clipboard write through `@tauri-apps/api/clipboard` instead. Replace the import with:

```typescript
import { writeText } from '@tauri-apps/api/clipboard';
```

No extra npm package needed.

### `tauri-plugin-store` Settings Store

`get_settings` and `save_settings` commands take a `State<'_, Store<Wry>>` parameter. The store must be initialized in `lib.rs` with a path before commands are registered:

```rust
.plugin(
    tauri_plugin_store::Builder::default()
        .build()
)
```

The store file is automatically saved to the Tauri app data directory (`~/Library/Application Support/com.efecelik.localhost/`).

---

## Complete Directory Tree (Final State)

```
localhost/
├── .github/
│   └── workflows/
│       ├── release-macos.yml
│       └── update-homebrew.yml
├── docs/
│   └── plans/
│       ├── 2026-03-20-localhost-design.md
│       └── 2026-03-20-project-scaffold-plan.md   ← this file
├── scripts/                                        ← empty, for future scripts
├── src/
│   ├── components/
│   │   ├── ActionButtons.tsx
│   │   ├── DetailPanel.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── MenuDropdown.tsx
│   │   ├── PortBadge.tsx
│   │   ├── ProcessItem.tsx
│   │   ├── ProjectGroup.tsx
│   │   ├── ProjectList.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   └── useProcessPoller.ts
│   ├── lib/
│   │   └── tauri.ts
│   ├── stores/
│   │   └── processStore.ts
│   ├── styles/
│   │   └── index.css
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   │   ├── macos/
│   │   │   └── icon.icns             ← generate with: pnpm icons
│   │   ├── shared/
│   │   │   ├── 32x32.png
│   │   │   ├── 128x128.png
│   │   │   ├── 128x128@2x.png
│   │   │   ├── 256x256.png
│   │   │   ├── 512x512.png
│   │   │   └── icon.png
│   │   ├── windows/
│   │   │   └── icon.ico
│   │   ├── icon-source.png           ← 1024x1024 source PNG, hand-crafted
│   │   └── tray-icon.png             ← 22x22 @2x (44px) template PNG
│   ├── src/
│   │   ├── scanner/
│   │   │   ├── mod.rs
│   │   │   ├── port_scanner.rs
│   │   │   ├── dev_tools.rs
│   │   │   └── docker.rs
│   │   ├── commands.rs
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── project_resolver.rs
│   │   └── types.rs
│   ├── Cargo.toml
│   ├── entitlements.plist
│   ├── Info.plist
│   └── tauri.conf.json
├── .gitignore
├── CLAUDE.md
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

**Icon files note:** The `src-tauri/icons/` directory must have at minimum `icons/shared/icon.png` (1024x1024) to build. Run `pnpm icons src-tauri/icons/icon-source.png` after placing the source PNG — Tauri CLI generates all icon sizes automatically. For the tray icon `tray-icon.png`: create a 44x44 transparent PNG with a simple `://` text mark (the `iconAsTemplate: true` flag in tauri.conf.json tells macOS to treat it as a template image that automatically adapts to light/dark menu bar).

---

*End of scaffold plan. This document covers everything needed to go from an empty directory to a compiling, running Tauri app with all architectural pieces in place.*
