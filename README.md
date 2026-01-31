# AI Spotlight Panel

A macOS Spotlight-inspired AI assistant built with Tauri v2, React, and TypeScript. Trigger it from anywhere with a
global hotkey to get instant AI-powered answers and translations.

## Features

- **Global Hotkey**: Press `Option+Space` to toggle the spotlight panel from anywhere
- **AI Quick Answers**: Get instant responses powered by local Ollama models with web search capabilities
- **Real-time Translation**: Automatically detects and translates non-English text to English, with optional
  English-to-second-language output
- **Thinking Mode**: Optional chain-of-thought reasoning for more thorough responses
- **Native Experience**: Transparent, frameless window that appears above all other windows
- **System Tray**: Runs quietly in the background with easy access to options

## Screenshots

The spotlight panel appears as a floating search bar that can be summoned from any application.

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [Rust](https://rustup.rs/) - For building the Tauri backend
- [Ollama](https://ollama.ai/) - Local AI model runtime (must be running on port 11434)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/laruss/ai-spotlight-panel.git
   cd ai-spotlight-panel
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Install an Ollama model:
   ```bash
   ollama pull qwen3:30b
   # Or any other model you prefer
   ```

## Development

Start the development server:

```bash
bun run tauri-dev
```

This will:

- Start the Vite dev server on port 1420
- Build and run the Tauri application in development mode
- Enable hot-reload for frontend changes

### Available Scripts

| Command               | Description                              |
|-----------------------|------------------------------------------|
| `bun run dev`         | Start Vite dev server only               |
| `bun run tauri-dev`   | Start full Tauri development environment |
| `bun run build`       | Build TypeScript and production bundle   |
| `bun run tauri build` | Build production application bundle      |
| `bun run lint`        | Lint code using Biome                    |
| `bun run format`      | Format code using Biome                  |
| `bun run check`       | Run Biome's comprehensive check          |
| `bun run fix`         | Auto-fix lint, format, and type issues   |
| `bun run typecheck`   | Run TypeScript type checking             |

## Usage

1. **Launch the app** - After starting, the app runs in the system tray (no dock icon)

2. **Toggle Spotlight** - Press `Option+Space`

3. **Search or Ask** - Type your query:
    - Questions get AI-powered answers with web search
    - Non-English text is automatically translated

4. **Dismiss** - Press `Escape` or click outside the panel

5. **Access Options** - Click the system tray icon and select "Options" to:
    - Choose your Ollama model
    - Toggle thinking mode
    - Refresh available models
    - Configure the web search API URL and key
    - Set the translation second language (optional)

## Architecture

```
ai-spotlight-panel/
├── src/                    # React frontend
│   ├── components/         # UI components (shadcn/ui)
│   ├── hooks/              # Custom React hooks
│   ├── App.tsx             # Main spotlight component
│   ├── Options.tsx         # Settings window
│   └── Toast.tsx           # Toast notifications
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri commands and setup
│   │   └── main.rs         # Entry point
│   └── tauri.conf.json     # Tauri configuration
└── package.json
```

### Key Technologies

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Tauri 2, Rust
- **AI**: Ollama (local LLM inference)
- **Build Tools**: Vite 7, Biome, Bun

### Tauri Plugins

- `tauri-plugin-global-shortcut` - Global hotkey registration
- `tauri-plugin-store` - Persistent settings storage
- `tauri-plugin-autostart` - Launch on system startup
- `tauri-plugin-clipboard-manager` - Copy results to clipboard
- `tauri-plugin-http` - HTTP client for API requests
- `tauri-plugin-log` - Application logging
- `tauri-nspanel` (macOS) - Native panel behavior

## Configuration

### Environment Variables

No runtime environment variables are required. Web search settings are configured
in the Options window and stored locally.

### Settings (via Options window)

- **Ollama Model**: Select from available local models
- **Enable Thinking**: Toggle chain-of-thought reasoning mode
- **Web Search API URL**: Base endpoint used for web search
- **Web Search API Key**: Stored locally for authenticated search requests
- **Translation Second Language**: Translate English input to a selected language

## Building for Production

```bash
bun run tauri build
```

This creates bundles in `src-tauri/target/release/bundle/`:

- `.app` - Application bundle
- `.dmg` - Disk image for distribution

## Releases

Pre-built binaries are automatically created when the version is updated. To trigger a new release:

1. Update the version in the `VERSION` file in the project root
2. Commit and push to the `main` branch
3. GitHub Actions will automatically build and create a release

### Supported Platforms

| Platform | Architecture          | Artifacts |
|----------|-----------------------|-----------|
| macOS    | ARM64 (Apple Silicon) | `.dmg`    |
| macOS    | x64 (Intel)           | `.dmg`    |

Download the latest release from the [Releases](../../releases) page.

## Troubleshooting

### "App is damaged and can't be opened"

This happens because the app is not signed with an Apple Developer certificate. To fix:

```bash
xattr -cr /Applications/ai-spotlight-panel.app
```

Then open the app again.

### Ollama Connection Issues

Make sure Ollama is running:

```bash
ollama serve
```

Check if models are available:

```bash
ollama list
```

### Global Shortcut Not Working

- On macOS, grant Accessibility permissions in System Preferences
- The shortcut may conflict with other applications - check for conflicts

### Window Not Appearing

- Ensure the app has screen recording permissions on macOS
- Try restarting the application

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a PR.
