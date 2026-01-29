# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tauri v2 application** with a React + TypeScript frontend, designed to create an AI-powered spotlight panel (similar to macOS Spotlight). The application features an always-on-top, transparent, undecorated window that can be triggered via global shortcuts.

## Development Commands

### Frontend Development
- `bun run dev` - Start Vite dev server on port 1420
- `bun run build` - Build TypeScript and production bundle
- `bun run preview` - Preview production build
- `bun run typecheck` - Run TypeScript type checking without emitting files

### Code Quality
- `bun run lint` - Lint code using Biome (runs `bunx biome lint`)
- `bun run format` - Format code using Biome (runs `bunx biome format`)
- `bun run check` - Run Biome's comprehensive check (linting + formatting)
- `bun run fix` - Auto-fix issues: lint, format, and typecheck in sequence

### Tauri Development
- `bun run tauri-dev` - Start Tauri in development mode (builds both frontend and backend)
- `bun run tauri dev` - Alternative command (requires `bun` installation)
- `bun run tauri build` - Build production application bundle

### Important Notes
- This project uses **Bun** as the package manager, not npm/yarn/pnpm
- Vite dev server runs on fixed port **1420** with strict port enforcement (configured in vite.config.ts)
- The Tauri dev process automatically runs `bun run dev` as the `beforeDevCommand` (configured in tauri.conf.json)
- Code formatting uses **Biome** (not ESLint/Prettier) with tab indentation, double quotes, and LF line endings

## Architecture

### Dual Codebase Structure
The project follows Tauri's standard dual-codebase architecture:

1. **Frontend (`src/`)**: React + TypeScript + Vite
   - Entry point: `src/main.tsx`
   - Main component: `src/App.tsx`
   - Communicates with Rust backend via `@tauri-apps/api`

2. **Backend (`src-tauri/`)**: Rust
   - Entry point: `src-tauri/src/main.rs`
   - Library code: `src-tauri/src/lib.rs` - contains `run()` function and Tauri command definitions
   - Build script: `src-tauri/build.rs`

### Tauri Plugins Enabled
The application uses several Tauri v2 plugins initialized in `src-tauri/src/lib.rs`:
- `tauri-plugin-store` - Persistent key-value storage
- `tauri-plugin-log` - Logging with Info level filter
- `tauri-plugin-autostart` - Auto-launch on system startup (desktop only)
- `tauri-plugin-global-shortcut` - Register global keyboard shortcuts (desktop only)
- `tauri-plugin-opener` - Open URLs/files with default applications
- `tauri-plugin-http` - HTTP client for Rust backend

### Window Configuration
The main window is configured in `src-tauri/tauri.conf.json` with special properties:
- Label: "spotlight"
- Title: "AI Spotlight"
- Fixed size: 820x100px
- Non-resizable, frameless, always-on-top
- Transparent background
- Focus enabled by default
- Designed for a spotlight-style UI pattern

### Ollama Integration
The backend includes Ollama API integration for AI chat functionality:
- `list_models` command - Fetches available Ollama models from http://127.0.0.1:11434
- `chat_stream` command - Streams chat responses from Ollama API with token-by-token emission
- Events: `ollama://token` (per token), `ollama://done` (completion signal)
- Requires Ollama running locally on port 11434

### Frontend-Backend Communication
- Use `invoke()` from `@tauri-apps/api/core` to call Rust commands
- Example: `invoke("greet", { name: "World" })`
- Rust commands are defined with `#[tauri::command]` macro in `src-tauri/src/lib.rs`
- Commands must be registered in the `invoke_handler` using `tauri::generate_handler![command_name]`
- Listen to backend events using `listen()` from `@tauri-apps/api/event`

### UI Components
- **Use only shadcn/ui components** for all UI elements in the application
- Components are located in `src/components/ui/`
- shadcn CLI (version 3.5.0) is installed as a dev dependency
- **IMPORTANT**: For installing new shadcn components or getting component information, use the **shadcn MCP server** - do not manually install or look up documentation
- Components are built on top of Radix UI primitives with Tailwind CSS styling

## Code Style and Configuration

### TypeScript
- Target: ES2020
- Strict mode enabled with `noUnusedLocals` and `noUnusedParameters`
- Module resolution: "bundler" (Vite-specific)
- JSX: react-jsx (React 19 automatic runtime)
- Path alias: `@/*` maps to `./src/*`
- Use UTF-8 encoding for all TypeScript files

### Biome Configuration
- Formatter: Tab indentation, double quotes, semicolons always, LF line endings
- Linter: All recommended rules enabled
- Auto-organize imports on save
- VCS integration enabled (respects .gitignore)

### Rust Configuration
- Library name: `ai_spotlight_panel_lib`
- Crate types: staticlib, cdylib, rlib
- Edition: 2021
- Platform-specific plugins (autostart, global-shortcut) only compile for desktop targets using `cfg(not(any(target_os = "android", target_os = "ios")))`

## Dependencies

### Frontend
- React 19.1.0 with React DOM 19.1.0
- Vite 7.0.4 with @vitejs/plugin-react
- TypeScript 5.8.3
- Tailwind CSS 4.1.16 with @tailwindcss/vite plugin
- shadcn/ui 3.5.0 - UI component library (use MCP server for installation and documentation)
- Radix UI primitives (react-slot) - Foundation for shadcn components
- All Tauri v2 plugins for frontend integration

### Backend
- Tauri 2 core
- serde + serde_json for serialization
- reqwest 0.12 with streaming support for Ollama API
- futures-util 0.3 for async stream processing
- Platform-specific Tauri plugins (see Cargo.toml for conditional compilation)
- Use Tauri version 2.0, not 1.0. For documentation, use context7 mcp server and v2.tauri.app docs
