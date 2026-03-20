# Changelog

## [0.1.0] - 2026-03-21

### Added
- Auto-detect running dev processes via port scanning, dev tool matching, and Docker container enumeration
- Group processes by project folder (scans configured projects directory)
- Two-level list UI: project name headers with process details underneath
- Detail panel with CPU, memory, uptime, and PID information
- Quick actions: stop process, restart, open in terminal, open in editor, open in browser
- Copy port or path to clipboard
- macOS menu bar integration with tray icon
- Dark/light mode with system preference detection
- Draggable window
- Settings: configurable projects directory (folder picker), scan interval, editor preference, theme
- Native macOS folder picker for projects directory selection
- Homebrew distribution via tap

### Technical
- Built with Tauri 2.0, React 18, TypeScript, Tailwind CSS, Zustand
- macOS proc_pidinfo FFI for reliable process cwd detection
- netstat2 for TCP port listener detection
- bollard for Docker container scanning
- 5-second auto-refresh with manual refresh option
