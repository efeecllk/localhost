# localhost

A macOS menu bar app that shows every running dev process on your machine, grouped by project. No configuration needed -- it detects everything automatically.

<!-- screenshot -->

![macOS](https://img.shields.io/badge/macOS-13.0+-blue?logo=apple)
![Apple Silicon](https://img.shields.io/badge/Apple%20Silicon-M1%2FM2%2FM3%2FM4-black?logo=apple)
![Intel Mac](https://img.shields.io/badge/Intel%20Mac-Supported-gray?logo=apple)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?logo=tauri)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Why localhost

- **See everything at a glance.** Every port listener, dev server, database, and Docker container running on your machine -- grouped by project folder, visible from the menu bar.
- **Manage without switching windows.** Stop, restart, or open any process in your terminal, editor, or browser directly from the dropdown.
- **Zero configuration.** Automatically scans your projects directory every few seconds. No setup files, no manual registration, no CLI commands.
- **Catch forgotten processes.** That Express server you started two hours ago on `:3000` and forgot about? It shows up immediately.

Built for developers who run multiple projects simultaneously and lose track of what is still running.

---

## Features

| Feature | Description |
|---------|-------------|
| **Auto-Detection** | Finds port listeners, known dev tools (Node, Python, Go, Rust, Ruby, Java), and Docker containers automatically |
| **Project Grouping** | Groups processes by project folder using working directory analysis and project markers (`package.json`, `Cargo.toml`, `go.mod`, `.git`, and more) |
| **Process Details** | Shows CPU usage, memory consumption, uptime, and health status for each process |
| **Quick Actions** | Stop, restart, open in terminal, open in editor (VS Code / Cursor), open in browser, copy port or path |
| **Docker Support** | Detects Docker Compose projects and standalone containers with port mappings |
| **Dark / Light Mode** | Follows your system theme or set manually in settings |
| **Configurable Refresh** | Default 5-second polling with manual refresh available for instant updates |
| **Native Feel** | Frameless transparent window that behaves like a native macOS popup -- no Dock icon, no window chrome |

---

## Installation

### Homebrew (Recommended)

```bash
brew tap efeecllk/localhost
brew install --cask localhost
```

Works on both **Apple Silicon** (M1/M2/M3/M4) and **Intel** Macs automatically.

**Why Homebrew?**
- Automatic architecture detection
- Easy updates with `brew upgrade`
- Clean uninstall with `brew uninstall`
- No manual DMG mounting needed

### Direct Download

Download the latest `.dmg` from [GitHub Releases](https://github.com/efeecllk/localhost/releases):

| Architecture | File |
|-------------|------|
| Apple Silicon (M1/M2/M3/M4) | `localhost_x.x.x_aarch64.dmg` |
| Intel | `localhost_x.x.x_x64.dmg` |

### Build from Source

See the [Development](#development) section below.

### Requirements

- macOS 13.0 (Ventura) or later
- Docker Desktop (optional, for container detection)

---

## How It Works

Three detection engines run in parallel on a configurable interval (default: every 5 seconds).

### 1. Port Scanner

Uses the `sysinfo` crate to find all processes with open TCP listening ports. For each process, it reads the current working directory and walks up the directory tree looking for project markers (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `.git`). If the path falls under your configured projects directory, it groups under that project name.

### 2. Dev Tool Detector

Matches running process names against a built-in list of known dev tools to catch processes that may not be listening on a port yet (still compiling, starting up, etc.):

- **JavaScript/TypeScript:** `node`, `deno`, `bun`
- **Python:** `python`, `python3`, `uvicorn`, `gunicorn`, `flask`, `django`
- **Go:** `go`, `air`
- **Rust:** `cargo`, `rustc`
- **Ruby:** `ruby`, `rails`, `puma`
- **Java:** `java`, `gradle`, `mvn`
- **Databases:** `postgres`, `mysql`, `mongod`, `redis-server`
- **Servers:** `nginx`, `caddy`, `httpd`

### 3. Docker Scanner

Queries the Docker socket (`/var/run/docker.sock`) via the `bollard` crate to find running containers. Extracts container names, images, exposed ports, and status. Maps containers to projects using Docker Compose labels (`com.docker.compose.project.working_dir`), falling back to container name matching against project folder names.

### Project Resolution

```
process cwd -> walk up directory tree for .git / package.json / Cargo.toml
  -> found under ~/Desktop/Projects/X?  -> group under "X"
  -> found elsewhere?                    -> group under folder name
  -> can't determine?                    -> group under "Other"
```

Only the UI updates when the process list actually changes -- efficient diffing prevents unnecessary re-renders.

---

## Configuration

Open **Settings** from the gear icon in the dropdown header.

| Setting | Default | Description |
|---------|---------|-------------|
| **Projects Directory** | `~/Desktop/Projects` | Root directory to scan for project folders |
| **Scan Interval** | 5 seconds | How often to poll for running processes |
| **Editor** | `code` (VS Code) | Editor command for "Open in Editor" action. Supports `code`, `cursor`, or any CLI-launchable editor |
| **Theme** | System | `system`, `light`, or `dark` |

Settings are persisted locally on your machine.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Tauri 2.0 |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Process Detection | sysinfo (Rust crate) |
| Docker Detection | bollard (Rust crate) |
| Build Tool | Vite |
| Distribution | Homebrew tap + GitHub Actions |

---

## Development

### Prerequisites

- [Rust](https://rustup.rs/) stable
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- Xcode Command Line Tools (`xcode-select --install`)

### Setup

```bash
git clone https://github.com/efeecllk/localhost.git
cd localhost
pnpm install
```

### Commands

```bash
pnpm tauri dev          # Dev mode with hot reload
pnpm tauri build        # Production build (universal binary)
pnpm lint               # TypeScript type checking
```

### Project Structure

```
localhost/
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── MenuDropdown.tsx      # Main container
│   │   ├── ProjectList.tsx       # Scrollable project list
│   │   ├── ProjectGroup.tsx      # Per-project section
│   │   ├── ProcessItem.tsx       # Per-process row
│   │   ├── DetailPanel.tsx       # Process detail view
│   │   ├── ActionButtons.tsx     # Quick action buttons
│   │   ├── Settings.tsx          # Settings panel
│   │   └── EmptyState.tsx        # No processes view
│   ├── stores/
│   │   └── processStore.ts       # Zustand store
│   ├── hooks/
│   │   └── useProcessPoller.ts   # Polling loop
│   ├── lib/
│   │   └── tauri.ts              # Tauri invoke wrappers
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Tray icon, window management
│   │   ├── commands.rs           # Tauri command handlers
│   │   ├── types.rs              # Shared data types
│   │   ├── project_resolver.rs   # cwd -> project mapping
│   │   └── scanner/
│   │       ├── mod.rs            # Scanner orchestrator
│   │       ├── port_scanner.rs   # TCP port detection
│   │       ├── dev_tools.rs      # Known dev tool detection
│   │       └── docker.rs         # Docker container scanning
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── .github/workflows/            # CI/CD
│   ├── release-macos.yml         # macOS DMG builds
│   └── update-homebrew.yml       # Homebrew tap updates
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## Troubleshooting

### "App is damaged" or "Cannot be opened"

This happens because the app is not notarized with Apple. Run:

```bash
xattr -cr /Applications/localhost.app
```

### Docker containers not showing

Make sure Docker Desktop is running. localhost connects to `/var/run/docker.sock` -- if Docker is not running, container detection is silently skipped.

### Processes not grouping correctly

Check that your projects directory setting matches where your projects actually live. The default is `~/Desktop/Projects`. Processes with working directories outside this path will be grouped under "Other" or by their nearest project marker.

---

## Contributing

Contributions are welcome. To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `pnpm lint` to check for type errors
5. Commit using conventional format (`feat(scanner): add redis detection`)
6. Open a pull request

For bugs, please open an issue with steps to reproduce.

---

## License

MIT License -- see [LICENSE](LICENSE) for details.

---

Built by [Efe Celik](https://github.com/efeecllk) with [Tauri](https://tauri.app).
