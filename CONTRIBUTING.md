# Contributing to localhost

Thank you for your interest in contributing. This guide covers what you need to get started.

## Prerequisites

- [Rust](https://rustup.rs/) stable (1.77+)
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- Xcode Command Line Tools (`xcode-select --install`)
- Docker Desktop (optional, for container detection features)

## Setup

```bash
git clone https://github.com/efeecllk/localhost.git
cd localhost
pnpm install
pnpm tauri dev
```

## Development Workflow

1. **Create a branch** from `main` using the naming convention `feat/`, `fix/`, or `refactor/` prefix.
2. **Make your changes.** Keep each pull request focused on a single concern.
3. **Run checks before committing:**

```bash
pnpm lint                                           # TypeScript type checking
cd src-tauri && cargo clippy -- -W clippy::all       # Rust linting
cd src-tauri && cargo check                          # Rust compilation check
```

4. **Commit using conventional format:**
   - `feat(scanner): add redis detection`
   - `fix(ui): correct dark mode badge colors`
   - `refactor(store): simplify settings persistence`

5. **Open a pull request** against `main`.

## Project Structure

- `src/` -- React frontend (TypeScript, Tailwind CSS, Zustand)
- `src-tauri/src/` -- Rust backend (Tauri 2.0, sysinfo, bollard)
- `src/lib/tauri.ts` -- all frontend-to-backend communication (never call `invoke` directly)
- `src/stores/processStore.ts` -- single Zustand store for all app state
- `src-tauri/src/scanner/` -- three detection engines (port, dev tools, Docker)

## Code Conventions

### TypeScript
- Use the `@/` path alias for all imports from `src/`
- Tailwind classes only -- no inline styles, CSS modules, or styled-components
- Components in PascalCase, hooks/stores in camelCase

### Rust
- All Tauri commands go in `commands.rs` and are registered in `lib.rs`
- Use `#[serde(rename_all = "camelCase")]` on all structs shared with the frontend
- Handle errors gracefully -- return `Result<T, String>` from commands

### General
- Always use `pnpm`, never `npm` or `yarn`
- Keep commits small and focused
- Write descriptive commit messages explaining *why*, not just *what*

## Reporting Bugs

Open an issue with:
- macOS version and architecture (Apple Silicon or Intel)
- Steps to reproduce
- Expected vs actual behavior
- Any relevant error messages from the app or console

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
