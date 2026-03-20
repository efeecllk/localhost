# localhost

A macOS menu bar app that shows all your running dev processes grouped by project. No configuration needed -- it detects everything automatically.

![macOS](https://img.shields.io/badge/macOS-13.0+-blue?logo=apple)
![Apple Silicon](https://img.shields.io/badge/Apple%20Silicon-M1%2FM2%2FM3-black?logo=apple)
![Intel Mac](https://img.shields.io/badge/Intel%20Mac-Supported-gray?logo=apple)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?logo=tauri)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What It Does

- **See everything at a glance.** Every port listener, dev server, and Docker container running on your machine, grouped by project folder.
- **Manage without switching windows.** Stop, restart, or open any process in your terminal, editor, or browser directly from the menu bar.
- **Zero configuration.** Automatically scans your projects directory every 5 seconds. No setup, no config files, no manual registration.

Built for developers who run multiple projects simultaneously and lose track of what's still running.

---

## Features

| Feature | Description |
|---------|-------------|
| **Auto-Detection** | Finds port listeners, known dev tools (Node, Python, Go, Rust, Ruby, Java), and Docker containers automatically |
| **Project Grouping** | Groups processes by project folder based on working directory and project markers (`package.json`, `Cargo.toml`, `go.mod`, etc.) |
| **Detail View** | Shows CPU usage, memory consumption, uptime, and health status for each process |
| **Quick Actions** | Stop, restart, open in terminal, open in editor (VS Code / Cursor), open in browser, copy port or path |
| **Docker Support** | Detects Docker Compose projects and standalone containers with port mappings |
| **Dark / Light Mode** | Follows your system theme or set manually |
| **5-Second Refresh** | Automatic polling with manual refresh available for instant updates |

---

## Installation

### Homebrew (Recommended)

```bash
brew tap efeecllk/localhost
brew install --cask localhost
```

Works on both **Apple Silicon** (M1/M2/M3) and **Intel** Macs automatically.

### Direct Download

Download the latest `.dmg` from [GitHub Releases](https://github.com/efeecllk/localhost/releases).

### Requirements

- macOS 13.0 (Ventura) or later
- Docker Desktop (optional, for container detection)

---

## How It Works

Three detection engines run in parallel every 5 seconds:

1. **Port Scanner** -- Uses the `sysinfo` crate to find all processes with open TCP listening ports, then resolves each process's working directory to a project root.
2. **Dev Tool Detector** -- Matches running process names against a built-in list of known dev tools (node, python, cargo, go, uvicorn, postgres, redis, etc.) to catch processes that may not be listening on a port yet.
3. **Docker Scanner** -- Queries the Docker socket via the `bollard` crate to find running containers, extracting names, images, ports, and status. Maps containers to projects using Docker Compose labels.

Project resolution walks up from each process's working directory looking for markers like `.git`, `package.json`, or `Cargo.toml`. If the path falls under your configured projects directory (default: `~/Desktop/Projects`), it groups under that project name.

---

## Build from Source

### Prerequisites

- [Rust](https://rustup.rs/) stable
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- Xcode Command Line Tools

### Steps

```bash
# Clone the repository
git clone https://github.com/efeecllk/localhost.git
cd localhost

# Install dependencies
pnpm install

# Run in development
pnpm tauri dev

# Build for production
pnpm tauri build
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Tauri 2.0 |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Process Detection | sysinfo (Rust crate) |
| Docker Detection | bollard (Rust crate) |
| Build Tool | Vite |

---

## Troubleshooting

### "App is damaged" or "Cannot be opened"

```bash
xattr -cr /Applications/localhost.app
```

### Docker containers not showing

Make sure Docker Desktop is running. localhost connects to `/var/run/docker.sock` -- if Docker isn't running, container detection is silently skipped.

---

## License

MIT License -- see [LICENSE](LICENSE) for details.

---

Made with [Tauri](https://tauri.app)
