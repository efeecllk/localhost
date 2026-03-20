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
