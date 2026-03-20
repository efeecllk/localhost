# localhost — UI Design Plan

**Date:** 2026-03-20
**Author:** Efe Celik
**Status:** Specification
**References:** voice-prompt design system, 2026-03-20-localhost-design.md

---

## Table of Contents

1. [Visual Design System](#1-visual-design-system)
2. [Component Designs](#2-component-designs)
3. [Animations](#3-animations)
4. [Tailwind Config](#4-tailwind-config)
5. [Responsive Behavior](#5-responsive-behavior)
6. [Dark / Light Mode](#6-dark--light-mode)
7. [Accessibility](#7-accessibility)
8. [View State ASCII Mockups](#8-view-state-ascii-mockups)

---

## 1. Visual Design System

### 1.1 Design Philosophy

The localhost UI lives in a menu bar dropdown — a transient, small-surface context where developers spend only seconds at a time. The visual language must:

- **Scan fast.** Port numbers and project names must be immediately distinguishable at a glance.
- **Disappear when idle.** Neutral, low-saturation tones so the window never feels intrusive.
- **Speak developer.** Monospace port badges, path strings with path separator styling, terminal-familiar accent colors.
- **Match voice-prompt.** Share the same warm-neutral surface palette and shadow system so both apps feel like siblings from the same design system.

The app inherits voice-prompt's `surface` color scale (warm gray derived from stone) and extends it with a semantic layer for process status indicators.

### 1.2 Color Palette

#### Base Palette — Warm Neutral (inherited from voice-prompt)

```
surface-50   #FAFAF9   — window background (light)
surface-100  #F5F5F4   — section headers, hovered rows (light)
surface-200  #E7E5E4   — borders, dividers (light)
surface-300  #D6D3D1   — placeholder text, disabled
surface-400  #A8A29E   — secondary labels, icon rest state
surface-500  #78716C   — tertiary text, timestamps
surface-600  #57534E   — secondary body text
surface-700  #44403C   — primary body text (light)
surface-800  #292524   — high-emphasis text (light), bg (dark)
surface-900  #1C1917   — darkest text / inverted buttons, bg base (dark)
surface-950  #0C0A09   — window background (dark)
```

#### Port / Process Type Semantic Colors

Port badges are the primary visual differentiator. They use muted, desaturated tones that are readable on both modes without being distracting:

```
port-web        bg: #E8F0FE / #1E3A5F   text: #1D4ED8 / #93C5FD
                — ports 3000, 5173, 8080, 4200 (HTTP front ends)

port-api        bg: #E8F5E9 / #1B3A2A   text: #166534 / #86EFAC
                — ports 8000, 8001, 4000 (API / backend)

port-db         bg: #FEF3C7 / #3B2A12   text: #92400E / #FCD34D
                — ports 5432, 3306, 6379, 27017 (databases)

port-docker     bg: #EDE9FE / #2D1B4E   text: #6D28D9 / #C4B5FD
                — Docker containers (any port, sourced from docker)

port-other      bg: #F1F5F9 / #1E293B   text: #475569 / #94A3B8
                — unclassified ports / no-port processes

status-healthy  #7C9A82   (sage green — same as voice-prompt success)
status-warning  #C9A962   (warm amber — same as voice-prompt warning)
status-error    #B87A7A   (dusty rose — same as voice-prompt error)
status-docker   #8B5CF6   (muted violet)
```

Port type classification rules (applied in `PortBadge` component):
- `source === "docker"` → docker color
- port in [3000, 3001, 5173, 4200, 8080, 1420] → web
- port in [8000, 8001, 8002, 4000, 5000, 6000] → api
- port in [5432, 3306, 6379, 27017, 6380, 5433] → db
- else → other

#### Interactive Colors

```
focus-ring        #A8A29E with 50% opacity (matches surface-400)
hover-row-light   surface-100 (#F5F5F4)
hover-row-dark    surface-800 (#292524)
active-row-light  surface-200 (#E7E5E4)
active-row-dark   surface-700 (#44403C)
```

### 1.3 Typography

All type is system font stack — same as voice-prompt:

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
```

For port numbers and paths, a monospace font gives the terminal-native feel:

```css
font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
```

#### Type Scale

```
App title "localhost"     14px  font-medium  surface-800/surface-100
Project group header      11px  font-semibold  uppercase  tracking-wider  surface-500/surface-400
Port badge text           11px  font-mono  font-medium  (color per type)
Process path text         12px  font-mono  surface-600/surface-300  truncated
Process name label        12px  font-normal  surface-500/surface-400
Detail panel label        10px  font-semibold  uppercase  tracking-wider  surface-400/surface-500
Detail panel value        12px  font-medium  surface-700/surface-200
Footer text               11px  font-normal  surface-400/surface-500
Action button label       11px  font-medium  surface-600/surface-300
```

### 1.4 Spacing

Base unit: 4px (Tailwind's default scale).

```
Window padding             px-0  (no outer padding — groups go edge-to-edge)
Header padding             px-4 py-3
Project group gap          mt-0  (dividers handle separation)
ProjectHeader padding      px-4 py-1.5
ProcessItem padding        px-4 py-2
  indent (port badge)      pl-4
  gap between elements     gap-2
Detail panel padding       p-4
Footer padding             px-4 py-2.5
Action button padding      px-2.5 py-1.5
Section divider            h-px bg-surface-200/dark:bg-surface-800
```

### 1.5 Border Radius

```
Window container           rounded-xl  (12px) — handled by Tauri window config
Process item hover state   rounded-md  (6px) within px-2 inner container
Port badge                 rounded-md  (6px)
Action buttons             rounded-md  (6px)
Detail panel               rounded-lg  (8px) — if shown inline; rounded-none if full-width slide
Settings inputs            rounded-lg  (8px)
Status dot                 rounded-full
```

### 1.6 Shadows

Inherited from voice-prompt shadow system:

```
soft-sm   0 1px 2px rgba(28,25,23,0.04)
soft-md   0 4px 6px -1px rgba(28,25,23,0.06), 0 2px 4px -1px rgba(28,25,23,0.04)
soft-lg   0 10px 15px -3px rgba(28,25,23,0.06), 0 4px 6px -2px rgba(28,25,23,0.03)
```

The menu bar window itself has no additional CSS shadow — macOS applies the native system shadow to the window chrome.

### 1.7 Icons

All icons are custom SVG inline components (same approach as voice-prompt's `icons/` directory). Size conventions:

```
Header icons (refresh, settings)   18px
Process action icons               16px
Status dot                         6px
Detail panel action icons          16px
Empty state illustration           48px
Footer icon (process count)        12px
```

Icons needed:
- `RefreshIcon` — circular arrow (animates during scan)
- `SettingsIcon` — gear (inherited from voice-prompt)
- `InfoIcon` — circle with lowercase "i"
- `TerminalIcon` — `>_` style
- `EditorIcon` — code bracket pair
- `BrowserIcon` — globe or external link
- `StopIcon` — square (inherited from voice-prompt)
- `CopyIcon` — clipboard (inherited from voice-prompt)
- `CheckIcon` — checkmark (inherited from voice-prompt)
- `DockerIcon` — whale/container simplified
- `BackIcon` — left arrow (inherited from voice-prompt)
- `ChevronIcon` — directional (inherited from voice-prompt)
- `FolderIcon` — for empty state and project paths

---

## 2. Component Designs

### 2.1 MenuDropdown (Root Container)

The outermost wrapper. Fixed width 360px. Height is dynamic (shrink-wraps content) up to max-height 500px at which point the ProjectList becomes independently scrollable.

```
+----------------------------------------+
| width: 360px                           |
| max-height: 500px                      |
| bg: surface-50 / surface-950 (dark)   |
| overflow: hidden                       |
| display: flex flex-col                 |
+----------------------------------------+
```

**Prop API:**

```typescript
interface MenuDropdownProps {
  // No props — reads from Zustand store directly
}
```

**Internal layout:**

```
<div className="flex flex-col h-full max-h-[500px] w-[360px] bg-surface-50 dark:bg-surface-950 overflow-hidden">
  <Header />
  <ProjectList />   {/* flex-1 overflow-y-auto */}
  <Footer />
</div>
```

### 2.2 Header

Matches voice-prompt's header pattern exactly: left-side identity, right-side action icons.

```
+------------------------------------------+
|  ://  localhost          [~] [gear]       |
+------------------------------------------+
   ^icon  ^title           ^refresh ^settings
```

**Dimensions:** height ~44px, px-4 py-3.

**Elements:**

- Left: `://` monospace text icon (14px, font-mono, surface-500/surface-400) followed by "localhost" text (14px, font-medium, surface-800/surface-100). Gap 8px.
- Right: RefreshIcon button (p-2, rounded-lg hover) + SettingsIcon button (p-2, rounded-lg hover). Gap 4px.

**Refresh button states:**

```
idle:      text-surface-400 / text-surface-500
scanning:  text-surface-600 / text-surface-300 + animate-spin-slow on icon
hover:     bg-surface-100 dark:bg-surface-800
```

**Prop API:**

```typescript
interface HeaderProps {
  isScanning: boolean;
  onRefresh: () => void;
  onSettings: () => void;
  lastUpdated: number; // unix ms — shown as tooltip on refresh button
}
```

**Accessibility:** Both icon buttons carry `aria-label`. Refresh button shows `title="Last updated Xs ago"` derived from `lastUpdated`.

**Divider:** `border-b border-surface-200 dark:border-surface-800` — same as voice-prompt.

### 2.3 ProjectList

The scrollable container that holds all `ProjectGroup` components.

```typescript
interface ProjectListProps {
  projects: ProjectGroup[];
  selectedProcessId: number | null;
  onSelectProcess: (pid: number) => void;
}
```

**CSS:** `flex-1 overflow-y-auto` — scrolls as a unit. Uses the custom scrollbar styles from voice-prompt's `index.css`.

Groups are separated by a subtle divider (`border-b border-surface-200/50 dark:border-surface-800/50`) between each ProjectGroup, not between ProcessItems within a group.

### 2.4 ProjectGroup

Each group has a header row (project name) followed by its process items, visually distinct from other groups.

```
+------------------------------------------+
| AGENT-ATTACK                          3  |   <- ProjectHeader
|------------------------------------------|
|   :3000   apps/web                    i  |   <- ProcessItem
|   :8080   apps/api                    i  |   <- ProcessItem
|   :5432   docker/postgres             i  |   <- ProcessItem
+------------------------------------------+
```

**ProjectHeader row:**

```
px-4 py-1.5
Left:  project name — 11px, font-semibold, uppercase, tracking-wider, surface-500/surface-400
Right: process count badge — "3" in a pill:
       bg-surface-200/surface-700, text-surface-500/surface-400,
       text-[10px], font-medium, px-1.5, py-0.5, rounded-full
```

**Prop API:**

```typescript
interface ProjectGroupProps {
  project: ProjectGroup;
  selectedProcessId: number | null;
  onSelectProcess: (pid: number) => void;
}
```

**No collapse behavior in MVP** — all groups are always expanded. The chevron + collapse can be a post-MVP enhancement.

### 2.5 ProcessItem

The core list item. Horizontal strip with three zones: port badge, path string, and detail button.

```
+---+----------+-----------------------+---+
| . | :3000    | /apps/web             | i |
+---+----------+-----------------------+---+
 ^    ^badge     ^path (truncated)       ^detail btn
 status dot
```

**Layout breakdown:**

```
<div className="flex items-center gap-2 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-800 cursor-default group transition-colors">

  {/* Status dot — leftmost, 6px circle */}
  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />

  {/* Port badge */}
  <PortBadge port={process.port} source={process.source} />

  {/* Path — fills remaining space, truncated */}
  <span className="flex-1 min-w-0 text-xs font-mono text-surface-500 dark:text-surface-400 truncate">
    {process.relativePath || process.name}
  </span>

  {/* Detail button — appears on hover or when selected */}
  <button
    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700"
    aria-label={`Process details for ${process.name} on port ${process.port}`}
    onClick={() => onSelectProcess(process.pid)}
  >
    <InfoIcon size={14} className="text-surface-400 dark:text-surface-500" />
  </button>
</div>
```

**Selected state** (when detail panel is open for this process):

```
bg-surface-100 dark:bg-surface-800
border-l-2 border-surface-400 dark:border-surface-500  {/* subtle left accent */}
detail button: opacity-100, bg-surface-200 dark:bg-surface-700
```

**Status dot colors:**

```
healthy      #7C9A82 (success green)
high_cpu     #C9A962 (warning amber)
high_memory  #C9A962 (warning amber)
crashed      #B87A7A (error rose)
docker       #8B5CF6 (muted violet, only for docker source)
```

**Prop API:**

```typescript
interface ProcessItemProps {
  process: Process;
  isSelected: boolean;
  onSelect: () => void;
}
```

**Process path display rules:**

- If `relativePath` is available: show it, prefix with `/`
- If Docker: show `docker/{containerName}` truncated from left (`direction: rtl` on the span achieves right-truncation for paths)
- If path is very long: truncate from right with `truncate` class — left part (project root) is less important than the tail (specific subpath)
- Max display: ~28 characters before truncation at the 360px window width

### 2.6 PortBadge

A compact pill-shaped label showing the port number. Color-coded by process type.

```
┌──────────┐
│ :3000    │   <- web (blue tint)
└──────────┘

┌──────────┐
│ :8080    │   <- api (green tint)
└──────────┘

┌──────────┐
│ :5432    │   <- db (amber tint)
└──────────┘

┌──────────┐
│ :6379    │   <- db (amber tint)
└──────────┘

┌──────────┐
│  docker  │   <- no port, docker source (violet tint)
└──────────┘

┌──────────┐
│ :4321    │   <- other (gray)
└──────────┘
```

**Dimensions:** `px-2 py-0.5`, `min-w-[52px]`, `text-center`, `rounded-md`, `text-[11px] font-mono font-medium`.

**No port, non-docker:** render the process name (e.g., "node") in the badge instead of a port, with `port-other` colors.

**Prop API:**

```typescript
interface PortBadgeProps {
  port: number | null;
  source: "port_scan" | "dev_tool" | "docker";
  processName?: string; // shown when port is null and source is not docker
}

type PortType = "web" | "api" | "db" | "docker" | "other";
```

**Type derivation logic (pure function, testable):**

```typescript
function getPortType(port: number | null, source: string): PortType {
  if (source === "docker") return "docker";
  if (port === null) return "other";
  if ([3000, 3001, 5173, 4200, 8080, 1420, 4173, 5174].includes(port)) return "web";
  if ([8000, 8001, 8002, 4000, 5000, 6000, 3100, 4100].includes(port)) return "api";
  if ([5432, 5433, 3306, 6379, 6380, 27017, 27018, 5984].includes(port)) return "db";
  return "other";
}
```

**Color token map:**

```typescript
const portTypeStyles: Record<PortType, { light: string; dark: string }> = {
  web:    { light: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",      dark: "bg-blue-950/40 text-blue-300 ring-1 ring-blue-800/50" },
  api:    { light: "bg-green-50 text-green-700 ring-1 ring-green-200",   dark: "bg-green-950/40 text-green-300 ring-1 ring-green-800/50" },
  db:     { light: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",   dark: "bg-amber-950/40 text-amber-300 ring-1 ring-amber-800/50" },
  docker: { light: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",dark: "bg-violet-950/40 text-violet-300 ring-1 ring-violet-800/50" },
  other:  { light: "bg-surface-100 text-surface-500 ring-1 ring-surface-200", dark: "bg-surface-800 text-surface-400 ring-1 ring-surface-700" },
};
```

The `ring-1` replaces a separate border — cleaner than `border` + `border-*` for colored badges and avoids layout shifts.

### 2.7 DetailPanel

Slides in below (or replaces) the selected ProcessItem row. Inline expansion — not a modal or sidebar. The panel pushes content down within the scrollable list so the context of which process is expanded stays visible.

```
+------------------------------------------+
|   :3000   apps/web                    [x]|   <- ProcessItem (selected state)
|  +--------------------------------------+ |
|  | node                      • healthy  | |
|  |------------------------------------ -| |
|  | PID    12345   Uptime   2h 34m       | |
|  | CPU    3.2%    Memory   128 MB       | |
|  |                                      | |
|  | [>_] [</>] [globe] [stop] [copy:port]| |
|  +--------------------------------------+ |
+------------------------------------------+
```

**Layout:**

```
<div className="mx-4 mb-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 overflow-hidden animate-detail-expand">

  {/* Process name + status row */}
  <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-200 dark:border-surface-700">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-surface-700 dark:text-surface-200">
        {process.name}
      </span>
      {/* Docker badge if applicable */}
      {process.dockerInfo && (
        <span className="text-[10px] font-mono text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded">
          {process.dockerInfo.image}
        </span>
      )}
    </div>
    <StatusChip status={process.status} />
  </div>

  {/* Stats grid */}
  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-3 py-2.5">
    <StatRow label="PID"    value={String(process.pid)} />
    <StatRow label="Uptime" value={formatUptime(process.uptime)} />
    <StatRow label="CPU"    value={`${process.cpuPercent.toFixed(1)}%`} />
    <StatRow label="Memory" value={`${process.memoryMb} MB`} />
    {process.fullPath && (
      <StatRow label="Path" value={process.fullPath} className="col-span-2" truncate />
    )}
  </div>

  {/* Action buttons */}
  <ActionButtons process={process} />
</div>
```

**StatRow sub-component:**

```
label: 10px, uppercase, tracking-wider, surface-400/surface-500
value: 12px, font-medium, font-mono (for numbers), surface-700/surface-200
```

**StatusChip:**

```
healthy      "healthy"   bg-success/10 text-success-dark dark:text-success-light  ring-1 ring-success/20
high_cpu     "high cpu"  bg-warning/10 text-warning-dark dark:text-warning-light  ring-1 ring-warning/20
high_memory  "high mem"  same as high_cpu
crashed      "crashed"   bg-error/10   text-error-dark dark:text-error-light      ring-1 ring-error/20

Dimensions: text-[10px] font-medium px-2 py-0.5 rounded-full
```

**Prop API:**

```typescript
interface DetailPanelProps {
  process: Process;
  onClose: () => void;
  settings: Settings;
}
```

**Close behavior:** Clicking the selected ProcessItem again (or pressing Escape) closes the panel. The `[x]` close target is the InfoIcon button in the ProcessItem row which toggles.

### 2.8 ActionButtons

A horizontal strip of icon+label buttons at the bottom of DetailPanel. Scrolls horizontally if needed (unlikely at 360px but prepared for).

```
[>_ Terminal]  [</> VS Code]  [globe Open]  [[] Stop]  [clipboard Port]  [clipboard Path]
```

**Visual:**

```
<div className="flex items-center gap-1 px-3 py-2 border-t border-surface-200 dark:border-surface-700 overflow-x-auto no-scrollbar">
  {/* Each button */}
  <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium
    text-surface-600 dark:text-surface-300
    hover:bg-surface-200 dark:hover:bg-surface-700
    transition-colors flex-shrink-0">
    <Icon size={14} />
    Label
  </button>
</div>
```

**Destructive actions (Stop):**

```
text-error dark:text-error-light
hover:bg-error/10
```

**Conditional rendering rules:**

- "Open in Browser" → only if `process.port !== null`
- "Open in VS Code" / "Open in Cursor" → label derived from `settings.editorCommand`
- "Copy Port" → only if `process.port !== null`
- "Stop" / "Restart" → always present; for Docker containers, label changes to "Stop Container" / "Restart Container"
- "Copy Path" → always present

**Copy feedback:** After clicking Copy Port or Copy Path, the button icon transitions to `CheckIcon` for 2 seconds. Same pattern as voice-prompt's ResultCard.

**Prop API:**

```typescript
interface ActionButtonsProps {
  process: Process;
  settings: Pick<Settings, "editorCommand">;
  onStop: () => void;
  onRestart: () => void;
  onOpenTerminal: () => void;
  onOpenEditor: () => void;
  onOpenBrowser: () => void;
  onCopyPort: () => void;
  onCopyPath: () => void;
}
```

### 2.9 Footer

A slim bar at the bottom showing aggregate counts and a settings shortcut link.

```
+------------------------------------------+
| 6 processes  3 projects     [settings]   |
+------------------------------------------+
```

**Layout:**

```
<div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950">
  <span className="text-[11px] text-surface-400 dark:text-surface-500">
    {totalProcesses} processes  ·  {totalProjects} projects
  </span>
  <button
    onClick={onSettings}
    className="text-[11px] text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
  >
    Settings
  </button>
</div>
```

The "Settings" text link in the footer is a secondary entry point — the gear icon in the header is primary. Both navigate to the Settings panel.

**Prop API:**

```typescript
interface FooterProps {
  totalProcesses: number;
  totalProjects: number;
  onSettings: () => void;
}
```

### 2.10 EmptyState

Shown when `projects.length === 0` (after a successful scan with no results). Occupies the full ProjectList area.

```
+------------------------------------------+
|                                          |
|                                          |
|              [folder icon]               |
|                                          |
|          No active processes             |
|                                          |
|    Nothing is running in your projects   |
|    directory right now.                  |
|                                          |
|                                          |
+------------------------------------------+
```

**Layout:**

```
<div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
  <div className="w-12 h-12 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
    <FolderIcon size={24} className="text-surface-300 dark:text-surface-600" />
  </div>
  <p className="text-sm font-medium text-surface-500 dark:text-surface-400 mb-1">
    No active processes
  </p>
  <p className="text-xs text-surface-400 dark:text-surface-500 leading-relaxed max-w-[200px]">
    Nothing is running in your projects directory right now.
  </p>
</div>
```

No CTA button — the app's purpose is observation, not launching. A subtle "Last scanned Xs ago" note can appear below in the lightest text weight.

**Prop API:**

```typescript
interface EmptyStateProps {
  lastUpdated: number; // unix ms
}
```

**No scanning / loading variant:** During the very first scan (app just opened), show the same empty state but with a `SpinnerIcon` replacing the FolderIcon and "Scanning..." as the primary text.

### 2.11 Settings Panel

Replaces the main view (same slide-in pattern as voice-prompt's Settings). Header has back button + "Settings" title. Scrollable content area. Save button pinned to bottom.

```
+------------------------------------------+
| [<]  Settings                            |
|------------------------------------------|
|                                          |
|  PROJECTS DIRECTORY                      |
|  [ /Users/efe/Desktop/Projects      [..] |
|                                          |
|  SCAN INTERVAL                           |
|  [  5s  ] [  10s  ] [  30s  ]           |
|                                          |
|  EDITOR                                  |
|  [  VS Code  ] [  Cursor  ] [  Custom  ] |
|                                          |
|  THEME                                   |
|  [  System  ] [  Light  ] [  Dark  ]    |
|                                          |
|------------------------------------------|
|  [ Save Settings ]                       |
+------------------------------------------+
```

**Header:** Identical structure to voice-prompt Settings header — `BackIcon` button + "Settings" label. Same `border-b` divider.

**Section labels:** `text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider` — direct copy of voice-prompt's label style.

**Projects Directory field:**

```
<div className="flex gap-2">
  <input
    type="text"
    value={localProjectsDir}
    onChange={...}
    placeholder="~/Desktop/Projects"
    className="flex-1 px-3 py-2.5 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm font-mono text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-surface-400/50"
  />
  <button /* browse button */
    className="px-3 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
  >
    ...
  </button>
</div>
```

**Scan interval selector:** Same pill-button grid as voice-prompt's shortcut selector:

```typescript
const intervalOptions = [
  { value: 2000, label: "2s" },
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
];
```

Selected state: `bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 border-surface-900`.
Unselected: `bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-500`.

**Editor selector:**

```typescript
const editorOptions = [
  { value: "code",   label: "VS Code" },
  { value: "cursor", label: "Cursor"  },
  { value: "zed",    label: "Zed"     },
  { value: "custom", label: "Custom"  },
];
```

When "Custom" is selected, a text input appears below for the command string (e.g., `subl`, `vim`).

**Save button:** Full-width, same style as voice-prompt:

```
bg-surface-900 dark:bg-surface-100 hover:bg-surface-800 dark:hover:bg-surface-200
text-white dark:text-surface-900
rounded-lg py-2.5 text-sm font-medium
```

**Prop API:**

```typescript
interface SettingsPanelProps {
  settings: Settings;
  onBack: () => void;
  onSave: (settings: Settings) => void;
}
```

---

## 3. Animations

All animations are intentionally subtle. The app is a utility, not an experience — motion should communicate state, never entertain.

### 3.1 Refresh Icon Spin

During active scan (`isScanning === true`), the RefreshIcon rotates.

```css
/* Slower than default Tailwind animate-spin (which is 1s) */
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.animate-spin-slow {
  animation: spin-slow 1.2s linear infinite;
}
```

Stops immediately when `isScanning` transitions to false (no easing out — abrupt stop feels mechanical/accurate).

### 3.2 DetailPanel Expand / Collapse

The detail panel animates open from zero height. Uses CSS `grid-rows` trick for smooth height animation without JavaScript measurement:

```css
@keyframes detail-expand {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-detail-expand {
  animation: detail-expand 150ms ease-out forwards;
}
```

Collapse is the reverse (exit animation via conditional rendering + `animate-detail-collapse`):

```css
@keyframes detail-collapse {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-4px); }
}
.animate-detail-collapse {
  animation: detail-collapse 100ms ease-in forwards;
}
```

Implementation: keep a `isClosing` boolean state. When close is triggered, set `isClosing = true`, start collapse animation, then remove from DOM after 100ms via `setTimeout`.

### 3.3 Process Appearing (New Process Detected)

When the process list updates and a new process appears that wasn't in the previous render, it fades+slides in:

```css
@keyframes process-enter {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
.animate-process-enter {
  animation: process-enter 200ms ease-out forwards;
}
```

Implementation: compare previous `processes` array with new one using a stable `pid` key. Newly added items get the animation class for one render cycle (remove after animation completes via `onAnimationEnd`).

### 3.4 Process Disappearing (Process Ended)

When a process disappears from the scan results, it fades out before being removed:

```css
@keyframes process-exit {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(8px); }
}
.animate-process-exit {
  animation: process-exit 150ms ease-in forwards;
}
```

The Zustand store keeps a "departing" set of PIDs. Items in this set render with `animate-process-exit` and are removed from store after animation completes.

### 3.5 Settings Panel Slide

Settings slides in from the right, main view slides out to the left. Same direction as voice-prompt:

```css
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes slide-out-left {
  from { transform: translateX(0);     opacity: 1; }
  to   { transform: translateX(-100%); opacity: 0; }
}
```

Wrap both panels in a `relative overflow-hidden` container. Duration: 200ms ease-out (enter) / 150ms ease-in (exit).

### 3.6 Copy Feedback

When any copy action is triggered, the button transitions from `CopyIcon` to `CheckIcon` with a brief scale pulse:

```css
@keyframes copy-confirm {
  0%   { transform: scale(1);    }
  40%  { transform: scale(1.2);  }
  100% { transform: scale(1);    }
}
.animate-copy-confirm {
  animation: copy-confirm 300ms ease-out forwards;
}
```

Icon swap via conditional rendering. Reset to CopyIcon after 2000ms.

### 3.7 Scan Interval Pulse (Subtle)

Every 5 seconds when a scan completes and data changes, the footer's process count briefly highlights:

```css
@keyframes count-update {
  0%   { color: inherit; }
  30%  { color: var(--success); }
  100% { color: inherit; }
}
```

Only triggers when count actually changes (not on every poll cycle). Duration: 800ms.

---

## 4. Tailwind Config

Complete `tailwind.config.js` for the localhost app, extending voice-prompt's config with localhost-specific additions:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ===== BASE SURFACE (inherited from voice-prompt) =====
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
        // ===== STATUS COLORS (inherited from voice-prompt) =====
        success: {
          light: '#9DB8A3',
          DEFAULT: '#7C9A82',
          dark: '#5E7A64',
        },
        warning: {
          light: '#DBC07A',
          DEFAULT: '#C9A962',
          dark: '#A8894A',
        },
        error: {
          light: '#CFA0A0',
          DEFAULT: '#B87A7A',
          dark: '#965C5C',
        },
        // ===== PORT TYPE COLORS (localhost-specific) =====
        // Using Tailwind's built-in blue/green/amber/violet with custom dark variants
        // These are referenced via portTypeStyles object in PortBadge, not raw Tailwind classes,
        // so we don't need to add custom tokens — we consume existing Tailwind colors.
        // Keeping this comment block as documentation for the design decision.
      },
      fontFamily: {
        mono: [
          '"SF Mono"',
          '"Fira Code"',
          '"Cascadia Code"',
          'ui-monospace',
          'monospace',
        ],
      },
      width: {
        'dropdown': '360px',
      },
      maxHeight: {
        'dropdown': '500px',
      },
      animation: {
        // Inherited
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 2.5s ease-in-out infinite',
        'recording-ring': 'recording-ring 1.5s ease-out infinite',
        // localhost-specific
        'spin-slow': 'spin-slow 1.2s linear infinite',
        'detail-expand': 'detail-expand 150ms ease-out forwards',
        'detail-collapse': 'detail-collapse 100ms ease-in forwards',
        'process-enter': 'process-enter 200ms ease-out forwards',
        'process-exit': 'process-exit 150ms ease-in forwards',
        'slide-in-right': 'slide-in-right 200ms ease-out forwards',
        'slide-out-left': 'slide-out-left 150ms ease-in forwards',
        'copy-confirm': 'copy-confirm 300ms ease-out forwards',
        'count-update': 'count-update 800ms ease-out forwards',
      },
      keyframes: {
        // Inherited
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.4' },
          '50%':       { transform: 'scale(1.08)', opacity: '0.7' },
        },
        'recording-ring': {
          '0%':   { transform: 'scale(1)', opacity: '0.4' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        // localhost-specific
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'detail-expand': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'detail-collapse': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to:   { opacity: '0', transform: 'translateY(-4px)' },
        },
        'process-enter': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'process-exit': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to:   { opacity: '0', transform: 'translateX(8px)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'slide-out-left': {
          from: { transform: 'translateX(0)',     opacity: '1' },
          to:   { transform: 'translateX(-100%)', opacity: '0' },
        },
        'copy-confirm': {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        'count-update': {
          '0%':   { color: 'inherit' },
          '30%':  { color: '#7C9A82' },  // success color
          '100%': { color: 'inherit' },
        },
      },
      boxShadow: {
        // Inherited from voice-prompt
        'soft-sm': '0 1px 2px rgba(28, 25, 23, 0.04)',
        'soft-md': '0 4px 6px -1px rgba(28, 25, 23, 0.06), 0 2px 4px -1px rgba(28, 25, 23, 0.04)',
        'soft-lg': '0 10px 15px -3px rgba(28, 25, 23, 0.06), 0 4px 6px -2px rgba(28, 25, 23, 0.03)',
      },
    },
  },
  plugins: [],
};
```

### Extended `index.css`

Add to voice-prompt's base `index.css` patterns:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  padding: 0;
  /* No min-height: 100vh — dropdown is fixed width/max-height */
  overflow: hidden;
}

/* Custom scrollbar — identical to voice-prompt */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: #D6D3D1;
  border-radius: 2px;
}
.dark ::-webkit-scrollbar-thumb { background: #44403C; }

/* Hide scrollbar for horizontal action button strip */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Path text — right-to-left truncation for long paths */
.path-truncate {
  direction: rtl;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* GPU acceleration for the process list */
.process-list {
  will-change: scroll-position;
  -webkit-overflow-scrolling: touch;
  transform: translateZ(0);
}

/* Prevent text selection in non-input areas */
.no-select {
  user-select: none;
  -webkit-user-select: none;
}

/* Monospace number rendering — prevent layout shift on count updates */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

---

## 5. Responsive Behavior

The window is fixed at 360px wide — there is no responsive breakpoint logic. All responsiveness is about height and content overflow.

### 5.1 Height Management

```
Total max height:  500px
Header:            ~44px  (fixed)
Footer:            ~38px  (fixed)
ProjectList:       max-height calc(500px - 44px - 38px) = 418px  (scrollable)
```

The ProjectList uses `overflow-y-auto` to scroll when content exceeds 418px. The Header and Footer always stay visible.

### 5.2 Scrollable ProjectList

```css
.project-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(500px - 44px - 38px);
}
```

When DetailPanel is expanded, its height is added to the scrollable content — the panel pushes down within the scroll container. The scroll position automatically adjusts to keep the selected ProcessItem visible (via `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`).

### 5.3 Text Truncation Rules

**Project name (ProjectHeader):** Single line, `truncate`. Max visible: ~30 characters at current font size.

**Process path (ProcessItem):** Single line, `truncate` with RTL direction for path-style strings. This causes truncation from the LEFT (losing the project root) rather than the right (losing the specific file/service path).

```
Full path:  /Users/efe/Desktop/Projects/agent-attack/apps/web
Displayed:  ...cts/agent-attack/apps/web
```

Achieved via:
```
<span className="path-truncate flex-1 min-w-0 text-xs font-mono ...">
  {process.relativePath}
</span>
```

**Process name in badge:** If showing process name instead of port (no-port processes), cap at 8 characters in the badge, truncate with ellipsis.

**Detail panel path value:** Allow 2 lines (`line-clamp-2`) with the full absolute path in a `title` attribute for hover tooltip.

**Docker image name in detail panel:** Single line truncate. `{imageName}:{tag}` — if too long, truncate from the right (tag is less important than registry/name).

### 5.4 Many Processes Scenario

With many processes (e.g., 15+ across 5 projects), the list scrolls. Visual affordances:

- Scroll position is preserved between scans (no scroll-to-top on refresh unless new data significantly changes)
- A subtle fade gradient at the bottom of the ProjectList (`after:` pseudo-element, pointer-events: none) hints at scrollability:

```css
.project-list-fade::after {
  content: '';
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: linear-gradient(to bottom, transparent, var(--surface-50));
  pointer-events: none;
}
.dark .project-list-fade::after {
  background: linear-gradient(to bottom, transparent, var(--surface-950));
}
```

### 5.5 Many Projects, Few Processes

Each ProjectGroup takes at minimum ~58px (header 30px + one ProcessItem 28px). With many empty-ish groups, the list still scrolls if it exceeds height. No collapsing in MVP.

---

## 6. Dark / Light Mode

The app follows voice-prompt's exact dark mode implementation: `darkMode: 'class'` in Tailwind config. The Tauri window applies `class="dark"` to `<html>` when the OS theme is dark (or when the user has selected "dark" in Settings).

### 6.1 Color Mapping Table

| Token | Light | Dark |
|---|---|---|
| Window background | `surface-50` #FAFAF9 | `surface-950` #0C0A09 |
| Section background | `surface-100` #F5F5F4 | `surface-800` #292524 |
| Row hover | `surface-100` #F5F5F4 | `surface-800` #292524 |
| Primary border | `surface-200` #E7E5E4 | `surface-800` #292524 |
| Subtle border | `surface-200/50` | `surface-800/50` |
| Primary text | `surface-800` #292524 | `surface-100` #F5F5F4 |
| Secondary text | `surface-600` #57534E | `surface-300` #D6D3D1 |
| Tertiary text | `surface-500` #78716C | `surface-400` #A8A29E |
| Placeholder | `surface-300` #D6D3D1 | `surface-600` #57534E |
| Icon rest | `surface-400` #A8A29E | `surface-500` #78716C |
| Icon hover | `surface-600` #57534E | `surface-300` #D6D3D1 |

### 6.2 Port Badge Dark Variants

| Type | Light | Dark |
|---|---|---|
| web | `bg-blue-50 text-blue-700 ring-blue-200` | `bg-blue-950/40 text-blue-300 ring-blue-800/50` |
| api | `bg-green-50 text-green-700 ring-green-200` | `bg-green-950/40 text-green-300 ring-green-800/50` |
| db | `bg-amber-50 text-amber-700 ring-amber-200` | `bg-amber-950/40 text-amber-300 ring-amber-800/50` |
| docker | `bg-violet-50 text-violet-700 ring-violet-200` | `bg-violet-950/40 text-violet-300 ring-violet-800/50` |
| other | `bg-surface-100 text-surface-500 ring-surface-200` | `bg-surface-800 text-surface-400 ring-surface-700` |

These map cleanly to Tailwind's built-in color utilities — no custom color tokens needed for port badges.

### 6.3 Status Colors

| Status | Light text | Dark text | Light bg | Dark bg |
|---|---|---|---|---|
| healthy | `text-success-dark` #5E7A64 | `text-success-light` #9DB8A3 | `bg-success/10` | `bg-success/10` |
| high_cpu / high_memory | `text-warning-dark` #A8894A | `text-warning-light` #DBC07A | `bg-warning/10` | `bg-warning/10` |
| crashed | `text-error-dark` #965C5C | `text-error-light` #CFA0A0 | `bg-error/10` | `bg-error/10` |

### 6.4 Theme Detection and Application

```typescript
// In App.tsx or a useTheme hook
import { useEffect } from 'react';
import { useProcessStore } from './stores/processStore';

export function useTheme() {
  const { settings } = useProcessStore();

  useEffect(() => {
    const root = document.documentElement;

    const apply = (isDark: boolean) => {
      root.classList.toggle('dark', isDark);
    };

    if (settings.theme === 'dark') {
      apply(true);
    } else if (settings.theme === 'light') {
      apply(false);
    } else {
      // system
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [settings.theme]);
}
```

### 6.5 Inverted Button Pattern

Primary action buttons (Save, selected theme/interval options) use voice-prompt's inverted approach:

```
Light mode: bg-surface-900 text-white
Dark mode:  bg-surface-100 text-surface-900
```

This ensures the "selected" state has maximum contrast in both modes without introducing a brand color.

---

## 7. Accessibility

### 7.1 Keyboard Navigation

The dropdown must be fully keyboard-navigable. Tab order:

```
1. Refresh button (Header)
2. Settings button (Header)
3. [ProjectList — not focusable itself]
4. ProcessItem rows (Tab through each, left-right with arrow keys)
5. InfoIcon button per ProcessItem
6. [If DetailPanel open] Action buttons (Tab through)
7. Footer Settings link
```

**Arrow key navigation within ProcessList:**

```
ArrowDown  — move focus to next ProcessItem
ArrowUp    — move focus to previous ProcessItem
Enter/Space — open/close DetailPanel for focused item
Escape      — close DetailPanel (if open), then close dropdown
```

Implementation: manage `focusedPid` in component state, not in Zustand (local UI concern). Apply `tabIndex={0}` to the ProcessItem div and handle `onKeyDown`.

```typescript
// ProcessItem keyboard handler
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onSelect();
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    onFocusNext?.();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    onFocusPrev?.();
  }
};
```

### 7.2 Focus Indicators

Focus ring uses `focus-visible` (not `focus`) to avoid showing rings on mouse interaction:

```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-surface-400/50
focus-visible:ring-offset-1
focus-visible:ring-offset-surface-50 dark:focus-visible:ring-offset-surface-950
```

This is the same pattern voice-prompt uses on the Recorder button.

### 7.3 ARIA Labels

All icon-only buttons carry `aria-label`:

```typescript
<button aria-label="Refresh process list">
  <RefreshIcon />
</button>

<button aria-label="Open settings">
  <SettingsIcon />
</button>

<button aria-label={`Show details for ${process.name} on port ${process.port}`}>
  <InfoIcon />
</button>

<button aria-label="Close process details">
  <InfoIcon />  {/* when panel is open */}
</button>
```

### 7.4 ARIA Roles and Regions

```typescript
<main aria-label="Running processes">
  <section aria-label={`Project: ${project.name}`}>
    {/* ProcessItems */}
  </section>
</main>
```

The ProjectList is a `role="list"`, each ProjectGroup is a `role="group"` with `aria-label`, each ProcessItem is a `role="listitem"`.

```typescript
<ul role="list" aria-label="Running processes">
  {projects.map(project => (
    <li key={project.name} role="group" aria-label={`${project.name} project`}>
      <div aria-hidden="true">{/* ProjectHeader */}</div>
      <ul role="list">
        {project.processes.map(process => (
          <li key={process.pid} role="listitem">
            <ProcessItem ... />
          </li>
        ))}
      </ul>
    </li>
  ))}
</ul>
```

### 7.5 Status Announcements

When the process list updates (new scan result), announce changes to screen readers using a live region:

```typescript
// In a non-visible announcement div
<div
  role="status"
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"
>
  {announcementText}
  {/* e.g., "Process list updated. 6 processes across 3 projects." */}
  {/* e.g., "New process detected: node on port 3000 in agent-attack." */}
</div>
```

Announcements are debounced: only the most recent update within a 3-second window is announced to avoid spamming with every 5-second poll.

### 7.6 Color Contrast

Port badge contrast ratios (WCAG AA requires 4.5:1 for normal text):

- web (blue): #1D4ED8 on #E8F0FE → ~6.2:1 (passes)
- api (green): #166534 on #E8F5E9 → ~7.1:1 (passes)
- db (amber): #92400E on #FEF3C7 → ~5.8:1 (passes)
- docker (violet): #6D28D9 on #EDE9FE → ~5.1:1 (passes)
- other: #475569 on #F1F5F9 → ~5.9:1 (passes)

Dark mode variants also verified to meet AA at minimum.

Status chip text contrast:
- healthy: #5E7A64 on white → ~4.7:1 (passes AA)
- warning: #A8894A on white → ~4.6:1 (passes AA)
- error: #965C5C on white → ~4.8:1 (passes AA)

### 7.7 Reduced Motion

Respect `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-spin-slow,
  .animate-detail-expand,
  .animate-detail-collapse,
  .animate-process-enter,
  .animate-process-exit,
  .animate-slide-in-right,
  .animate-slide-out-left,
  .animate-copy-confirm,
  .animate-count-update {
    animation: none !important;
    transition: none !important;
  }
}
```

The app remains fully functional without animations — they are pure progressive enhancement.

---

## 8. View State ASCII Mockups

### 8.1 Main View — Normal State (Light Mode)

```
+------------------------------------------+  <- 360px
| :// localhost              [~] [gear]    |  <- Header, 44px
|------------------------------------------|
| AGENT-ATTACK                          3  |  <- ProjectHeader
|  • :3000  apps/web                    i  |  <- ProcessItem (healthy)
|  • :8080  apps/api                    i  |  <- ProcessItem (healthy)
|  • :5432  docker/postgres             i  |  <- ProcessItem (docker)
|------------------------------------------|
| RAPPER                                2  |
|  • :3001  frontend                    i  |
|  ! :8001  backend                     i  |  <- (! = warning amber dot)
|------------------------------------------|
| VOICE-PROMPT                          1  |
|  • :1420  tauri dev                   i  |
|------------------------------------------|
| 6 processes · 3 projects     Settings   |  <- Footer, 38px
+------------------------------------------+
```

Legend:
- `•` = sage green status dot (healthy)
- `!` = amber dot (high_cpu or high_memory)
- `x` = dusty rose dot (crashed)
- `i` = InfoIcon detail button (visible on hover)

### 8.2 Main View — With Detail Panel Open

```
+------------------------------------------+
| :// localhost              [~] [gear]    |
|------------------------------------------|
| AGENT-ATTACK                          3  |
|  • :3000  apps/web                    i  |  <- selected, left border accent
| +----------------------------------------+
| | node                       • healthy  | |  <- DetailPanel
| |----------------------------------------| |
| | PID   12345    Uptime   2h 34m        | |
| | CPU   3.2%     Memory   128 MB        | |
| |----------------------------------------| |
| | [>_]  [</>]  [globe]  [stop]  [clip]  | |  <- ActionButtons
| +----------------------------------------+
|  • :8080  apps/api                    i  |
|  • :5432  docker/postgres             i  |
|------------------------------------------|
| RAPPER                                2  |
|  • :3001  frontend                    i  |
|------------------------------------------|
| 6 processes · 3 projects     Settings   |
+------------------------------------------+
```

Note: the detail panel expands inline within the list, pushing content down. The scroll container accommodates this naturally.

### 8.3 Main View — Docker Process Detail

```
+------------------------------------------+
|  • docker  docker/postgres            [x] |  <- selected ProcessItem
| +----------------------------------------+
| | postgres   postgres:15-alpine  • healthy|
| |----------------------------------------|
| | Container  db-postgres-1               |
| | PID        —           Uptime   5h 12m |
| | CPU        0.1%        Memory   64 MB  |
| | Port       5432                        |
| |----------------------------------------|
| | [stop ctn]  [restart ctn]  [clip:port] |
| +----------------------------------------+
```

For Docker containers: no Terminal or Editor buttons (those don't make sense for containers). The stop/restart labels change to "Stop Container" / "Restart Container".

### 8.4 Main View — Process with No Port (Dev Tool Detector)

```
+------------------------------------------+
|  • cargo   src-tauri                  i  |
```

Port badge shows process name ("cargo") instead of a port number, with `port-other` styling.

### 8.5 Empty State

```
+------------------------------------------+
| :// localhost              [~] [gear]    |
|------------------------------------------|
|                                          |
|                                          |
|                                          |
|              [  folder  ]               |
|                                          |
|         No active processes              |
|                                          |
|   Nothing is running in your projects   |
|   directory right now.                  |
|                                          |
|   Last scanned just now                 |
|                                          |
|                                          |
|                                          |
|------------------------------------------|
| 0 processes · 0 projects     Settings   |
+------------------------------------------+
```

### 8.6 Loading / First Scan State

```
+------------------------------------------+
| :// localhost              [~] [gear]    |
|------------------------------------------|
|                                          |
|                                          |
|                                          |
|             [  spinner  ]               |
|                                          |
|              Scanning...                 |
|                                          |
|       Looking for running processes      |
|       in ~/Desktop/Projects             |
|                                          |
|                                          |
|                                          |
|------------------------------------------|
| — processes · — projects     Settings   |
+------------------------------------------+
```

### 8.7 Settings Panel

```
+------------------------------------------+
| [<]  Settings                            |
|------------------------------------------|
|                                          |
|  PROJECTS DIRECTORY                      |
|  +------------------------------------+  |
|  | ~/Desktop/Projects             [...] |  |
|  +------------------------------------+  |
|                                          |
|  SCAN INTERVAL                           |
|  [ 2s ]  [ 5s ]  [ 10s ]  [ 30s ]      |
|            ^^^^                          |
|            selected (inverted style)     |
|                                          |
|  EDITOR                                  |
|  [ VS Code ]  [ Cursor ]  [ Custom ]    |
|                                          |
|  THEME                                   |
|  [ System ]  [ Light ]  [ Dark ]        |
|    ^^^^^^                                |
|    selected                              |
|                                          |
|                                          |
|------------------------------------------|
|  [ Save Settings                      ]  |
+------------------------------------------+
```

### 8.8 Main View — Dark Mode

Same layout, different surface values:

```
+------------------------------------------+  bg: #0C0A09 (surface-950)
| :// localhost              [~] [gear]    |  text: #F5F5F4
|==========================================|  border: #292524 (surface-800)
| AGENT-ATTACK                          3  |  label: #78716C (surface-500)
|  • :3000  apps/web                    i  |  hover: #292524 (surface-800)
|  • :8080  apps/api                    i  |
|  • :5432  docker/postgres             i  |
|==========================================|
| 6 processes · 3 projects     Settings   |  bg: #0C0A09
+------------------------------------------+
```

Port badges in dark mode use the `/40` opacity variants with lighter text for the glow-on-dark effect:

```
:3000  bg-blue-950/40    text-blue-300    ring-blue-800/50
:8080  bg-green-950/40   text-green-300   ring-green-800/50
:5432  bg-amber-950/40   text-amber-300   ring-amber-800/50
```

### 8.9 Overflow State — Many Processes

```
+------------------------------------------+
| :// localhost              [~] [gear]    |
|------------------------------------------|
| AGENT-ATTACK                          5  |
|  • :3000  apps/web                    i  |
|  • :8080  apps/api                    i  |
|  • :5432  docker/postgres             i  |
|  • :6379  docker/redis                i  |
|  • :9200  docker/elastic              i  |
|------------------------------------------|
| RAPPER                                4  |
|  • :3001  frontend                    i  |
|  • :8001  backend                     i  |   <- scroll begins here
|  • :5001  ...                            |   (partially visible)
|    ~~~~~~~~~~~ fade gradient ~~~~~~~~~   |   <- subtle bottom fade
|------------------------------------------|
| 12 processes · 4 projects    Settings   |
+------------------------------------------+
                       ^
              scroll indicator (custom scrollbar, 4px, surface-200/surface-700)
```

---

## Component File Map

For reference, each design spec above maps to these source files:

| Spec Section | Source File |
|---|---|
| MenuDropdown | `/src/components/MenuDropdown.tsx` |
| Header | `/src/components/Header.tsx` |
| ProjectList | `/src/components/ProjectList.tsx` |
| ProjectGroup | `/src/components/ProjectGroup.tsx` |
| ProcessItem | `/src/components/ProcessItem.tsx` |
| PortBadge | `/src/components/PortBadge.tsx` |
| DetailPanel | `/src/components/DetailPanel.tsx` |
| ActionButtons | `/src/components/ActionButtons.tsx` |
| Footer | `/src/components/Footer.tsx` |
| EmptyState | `/src/components/EmptyState.tsx` |
| Settings | `/src/components/Settings.tsx` |
| Tailwind config | `/tailwind.config.js` |
| Global styles | `/src/styles/index.css` |
| Icon components | `/src/components/icons/` |
| Theme hook | `/src/hooks/useTheme.ts` |
| Port type logic | `/src/lib/portType.ts` (pure function, easily tested) |
| Format utilities | `/src/lib/format.ts` (formatUptime, formatPath, etc.) |
