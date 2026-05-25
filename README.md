# BrowserPilot

AI-powered browser automation with real-time sidebar activity feed.

## Quick Start

```bash
npm install
npm run build
npm run bundle
```

## Important Documentation

### 🔴 Read First: [AGENTS.md](./AGENTS.md)

This file contains **critical operational context** for AI agents working on this project:
- How to reload the Chrome extension after code changes
- Process lifecycle (wrapper, server, Chrome)
- Troubleshooting checklist when sidebar is not visible
- Key fixes applied and why
- Common commands for diagnostics

**Always read AGENTS.md before making any changes.**

## Commands

```bash
# Development
npm run build       # Compile TypeScript
npm run bundle      # Minify with esbuild
npm run dev         # Build + watch mode

# Testing
npm test            # Run test suite
```

## Architecture

- `src/mcp/wrapper.ts` — MCP server with 20 browser tools
- `src/server/server.ts` — HTTP server for session/sidebar state
- `extension/` — Chrome extension (content script, service worker, popup)
- `dist/` — Compiled and minified output

## License

MIT