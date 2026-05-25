# BrowserPilot - Development Guide

## Project Overview

BrowserPilot is an npm package that gives AI agents (via OpenCode) full browser 
automation control with a real-time activity sidebar. It uses MCP (Model Context 
Protocol) to expose browser tools that AI models can call autonomously.

**Key idea:** The AI decides when to open/close Chrome. The extension auto-loads. 
The sidebar shows what the AI is doing in real-time. The user can't interfere while 
the AI is controlling the browser (hard lock).

## User Experience

```powershell
# Install (one command)
npm install -g browser-pilot

# Setup (one command)
browser-pilot setup

# Use (just run OpenCode)
opencode
# AI has full browser control — opens/closes Chrome, navigates, clicks, types
# Sidebar shows real-time activity
# User can't interfere while AI is controlling
```

## Architecture

```
OpenCode
  └── MCP Wrapper (dist/mcp/wrapper.min.js)
        ├── Always registered (visible to AI from start):
        │   ├── browser_start          — Start Chrome + server (optional)
        │   ├── browser_stop           — Stop everything
        │   ├── browser_get_status     — Get session state
        │   ├── browser_navigate       — Go to URL
        │   ├── browser_click          — Click element (by UID from snapshot)
        │   ├── browser_type           — Type text into focused element
        │   ├── browser_fill           — Fill input field by UID
        │   ├── browser_scroll         — Scroll page up/down
        │   ├── browser_screenshot     — Take screenshot
        │   ├── browser_snapshot       — Get page DOM/accessibility tree
        │   ├── browser_press_key      — Press keyboard key
        │   ├── browser_wait           — Wait for text or time
        │   ├── browser_evaluate       — Run JavaScript
        │   ├── browser_new_tab        — Open new tab
        │   ├── browser_close_tab      — Close tab
        │   ├── browser_switch_tab     — Switch to tab
        │   ├── browser_get_tabs       — List open tabs
        │   ├── browser_get_url        — Get current URL
        │   ├── browser_hover          — Hover over element
        │   └── browser_drag           — Drag between elements
        │
        └── Each tool internally:
            ├── Calls ensureBrowserReady() (auto-starts if needed)
            ├── Delegates to chrome-devtools-mcp via MCP client
            ├── Logs action to sidebar
            └── Returns result to AI
```

## Data Flow

### 1. AI uses any browser tool (auto-start)
```
AI calls browser_navigate("https://google.com")
  → Tool handler calls ensureBrowserReady()
    → Checks server health → auto-starts if needed
    → Checks Chrome health → auto-launches if needed
    → Connects to chrome-devtools-mcp if needed
    → Starts sidebar session
  → Tool calls chrome-devtools-mcp navigate_page
  → chrome-devtools-mcp executes via CDP
  → Extension sidepanel picks up action, renders it
  → Session state: idle → launching → ready → running → ready
```

### 2. AI uses explicit start/stop
```
AI calls browser_start (optional — auto-start handles it)
  → Same as above but explicit

AI calls browser_stop
  → Disconnects chrome-devtools-mcp
  → Kills Chrome, kills server
  → Resets all state
  → Session: ready → closing → idle
```

## What Was Done (Completed)

### npm Package Structure
- Unified `package.json` with `bin`, `files`, `dependencies`
- `"type": "module"` for ESM output
- `tsconfig.json` with `"module": "Node16"` for proper ESM
- `bin/browser-pilot.js` — CLI entry point (thin wrapper, dynamic imports)
- `scripts/bundle.mjs` — esbuild bundler for obfuscated `.min.js` output
- `.gitignore`, `.npmignore` for clean publishing

### CLI Commands
- `browser-pilot setup` — Creates `~/.browser-pilot/` dir, config.json, adds MCP entry to OpenCode config
- `browser-pilot stop` — Kills server (by PID file) + Chrome (by profile args)
- `browser-pilot status` — Checks server health, Chrome health, OpenCode config

### MCP Wrapper (`src/mcp/wrapper.ts`)
- **Static tool registration** — All 20 browser tools registered at startup, visible to AI immediately
- **`ensureBrowserReady()` pattern** — Auto-starts server + Chrome + chrome-devtools-mcp on first tool call
- **`callChromeDevtoolsTool()` helper** — Handles session state, sidebar logging, and chrome-devtools-mcp delegation
- `browser_start` tool — Explicit start (optional, auto-start handles it)
- `browser_stop` tool — Stops Chrome + server, resets state
- `browser_get_status` tool — Returns session state
- 17 high-level browser tools — navigate, click, type, fill, scroll, screenshot, snapshot, press_key, wait, evaluate, new_tab, close_tab, switch_tab, get_tabs, get_url, hover, drag
- Cleanup on exit (kills server/Chrome if we started them)

### Coordination Server (`src/server/server.ts`)
- Express HTTP server on port 3026
- Session state management (idle/launching/ready/running/waiting/closing)
- Lock state management (agent/user/null)
- Session endpoints: `/session/start`, `/session/stop`, `/session/lock`, `/session/state`
- Sidebar endpoints: `/sidebar/start`, `/sidebar/end`, `/sidebar/action`, `/sidebar/state`
- PID file at `~/.browser-pilot/server.pid`
- Recordings at `~/.browser-pilot/recordings/`

### Chrome Extension
- `manifest.json` — MV3, permissions: sidePanel, tabs, activeTab
- `service_worker.js` — Polls server, broadcasts lock state to all tabs
- `content.js` — Hard lock overlay (blocks all mouse/keyboard when agent is controlling)
- `sidepanel.html/js` — Dark-themed activity feed with lock banner
- `popup.html/js` — Status popup

### Configuration
- `~/.browser-pilot/config.json` — Server port, Chrome port, logging level
- `~/.config/opencode/opencode.json` — MCP entry for BrowserPilot

## What Is Pending

### Not Yet Implemented
1. **Chrome Web Store publication** — Extension should be published for clean install (no nudge bar)
2. **Idle timeout** — Currently explicit stop only; could add auto-close after X minutes
3. **Step-level locking** — Currently hard lock during entire session; could unlock between steps
4. **User takeover** — "Take Control" button in overlay exists but doesn't communicate back to wrapper
5. **Session recordings playback** — Recordings are saved but no UI to replay them
6. **Error recovery** — If Chrome crashes mid-session, wrapper should detect and restart
7. **Multi-tab awareness** — Sidebar could show which tab is being controlled
8. **Screenshot capture** — Could auto-screenshot after each action for visual history

### Known Issues
1. **`--load-extension` nudge bar** — Chrome shows "Disable developer mode extensions" banner on each launch. Fixed by Chrome Web Store publication.
2. **Global install is symlink** — `npm install -g` from local dir creates symlink, not copy. Works for dev, but published package will be a real copy.

### Technical Debt
1. **ESM/CJS hybrid** — Wrapper and server output ESM, CLI uses dynamic imports. Could simplify.
2. **chrome-devtools-mcp spawn** — Currently uses `npx chrome-devtools-mcp` which may be slow. Could use `require.resolve` for direct binary path.
3. **Config deep merge** — Simple recursive merge, could use a proper library
4. **No tests** — No unit or integration tests exist

## File Structure

```
C:\Users\admin\browser-pilot\
├── bin/
│   └── browser-pilot.js          # CLI entry point (ESM, dynamic imports)
├── src/
│   ├── cli/
│   │   ├── setup.ts              # browser-pilot setup
│   │   ├── stop.ts               # browser-pilot stop
│   │   └── status.ts             # browser-pilot status
│   ├── server/
│   │   └── server.ts             # Express HTTP server (port 3026)
│   └── mcp/
│       └── wrapper.ts            # MCP server (stdio transport)
├── dist/                         # Compiled JS output (ESM)
│   ├── cli/
│   │   ├── setup.js + setup.min.js
│   │   ├── stop.js + stop.min.js
│   │   └── status.js + status.min.js
│   ├── server/
│   │   └── server.js + server.min.js
│   └── mcp/
│       └── wrapper.js + wrapper.min.js
├── scripts/
│   └── bundle.mjs                # esbuild bundler script
├── extension/                    # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── service_worker.js
│   ├── content.js
│   ├── sidepanel.html
│   ├── sidepanel.js
│   ├── popup.html
│   └── popup.js
├── package.json
├── tsconfig.json
├── .gitignore
├── .npmignore
└── node_modules/
```

## Key Files Reference

### wrapper.ts — MCP Server
- Lines 1-14: Imports (ESM with import.meta.url for __dirname)
- Lines 16-70: Interfaces (Config, ProcessState)
- Lines 72-78: Constants (CONFIG_DIR, CONFIG_FILE, PID_FILE)
- Lines 80-93: State variables (including isInitializing flag)
- Lines 95-106: Logging
- Lines 108-177: Config loading (getDefaultConfig, loadConfig, deepMerge)
- Lines 179-226: Health checks (checkServerHealth, checkChromeHealth, waitForHealthy)
- Lines 228-255: Chrome detection (findChromePath)
- Lines 257-316: Server management (startServer)
- Lines 318-387: Chrome management (launchChrome — with --load-extension)
- Lines 389-444: Sidebar management (httpRequest, ensureSidebarActive, endSidebar, addSidebarAction)
- Lines 446-473: chrome-devtools-mcp connection (connectToChromeDevtoolsMcp — idempotent)
- Lines 475-530: ensureBrowserReady (auto-start pattern)
- Lines 532-560: callChromeDevtoolsTool helper (session state + sidebar logging + delegation)
- Lines 562-613: Cleanup (also disconnects chrome-devtools-mcp)
- Lines 615-640: MCP server creation + browser_start tool
- Lines 642-690: browser_stop tool
- Lines 692-720: browser_get_status tool
- Lines 722-850: Static browser tools (navigate, click, type, fill, scroll, screenshot, snapshot, press_key, wait, evaluate, new_tab, close_tab, switch_tab, get_tabs, get_url, hover, drag)
- Lines 852-880: main() — eager connection attempt, stdio transport

### server.ts — HTTP Server
- Lines 1-47: Imports, interfaces, constants
- Lines 49-90: State, recordings dir, PID file, logging
- Lines 92-137: Session management (startSession, endSession, recordCommand)
- Lines 139-180: HTTP setup, CORS, identity, status endpoints
- Lines 182-230: Session endpoints (start, stop, lock, state)
- Lines 232-280: Sidebar endpoints (start, end, action, state)
- Lines 282-362: Sessions history, server listen, graceful shutdown

### content.js — Hard Lock Overlay
- Creates full-page overlay div with pointer-events: auto
- Blocks all mouse/keyboard/focus events
- Shows "AI is controlling the browser" banner
- "Take Control" button removes overlay
- Listens for LOCK_STATE messages from service worker
- Checks initial state on load

## Configuration Files

### ~/.browser-pilot/config.json
```json
{
  "server": { "port": 3026 },
  "chrome": { "port": 9222, "executable": "auto-detect" },
  "logging": { "level": "info" }
}
```

### ~/.config/opencode/opencode.json (relevant section)
```json
{
  "mcp": {
    "browser-pilot": {
      "type": "local",
      "command": ["node", "C:\\Users\\admin\\browser-pilot\\dist\\mcp\\wrapper.js"],
      "enabled": true
    }
  }
}
```

## Development Commands

```bash
# Build TypeScript
npm run build

# Bundle + minify (for publishing)
npm run bundle

# Build + bundle (for publishing)
npm run prepublishOnly

# Test CLI locally
node bin/browser-pilot.js setup
node bin/browser-pilot.js status
node bin/browser-pilot.js stop

# Install globally from local dir
npm install -g .

# Uninstall global
npm uninstall -g browser-pilot

# Pack for publishing
npm pack

# Publish to npm
npm publish
```

## How to Continue Development

### Adding a new MCP tool
1. Open `src/mcp/wrapper.ts`
2. Find the static tool registration section (after browser_drag)
3. Use `server.tool(name, description, schema, handler)`
4. In the handler, call `callChromeDevtoolsTool()` to delegate to chrome-devtools-mcp
5. The tool will be visible to AI immediately at startup

### Adding a new server endpoint
1. Open `src/server/server.ts`
2. Add `app.get/post(path, handler)` in the appropriate section
3. If it affects session state, update `sessionState` object

### Modifying the extension
1. Edit files in `extension/`
2. No build step needed — Chrome loads them directly
3. Reload extension in Chrome: `chrome://extensions/` → click reload icon

### Testing the wrapper standalone
```bash
# Start server manually
node dist/server/server.js

# Test wrapper (connects to stdio)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | node dist/mcp/wrapper.js
```

### Code protection (obfuscation)
1. `npm run build` — compiles TypeScript to JavaScript
2. `npm run bundle` — bundles + minifies to `.min.js` files
3. `npm run prepublishOnly` — runs both build + bundle
4. Only `.min.js` files are published (`.js` files are excluded by `.npmignore`)

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Tool visibility | Static registration | AI needs to see all tools at startup |
| Auto-start | Lazy init in each tool | Better UX — AI doesn't need to call browser_start first |
| Tool naming | `browser_*` prefix | Clear namespace, avoids conflicts with other MCP tools |
| chrome-devtools-mcp | Eager connect in main() | Faster first tool call; fallback to lazy if fails |
| Error handling | Return error text, don't throw | AI can read the error and retry/adjust |
| Sidebar logging | Every tool call | Real-time activity feed |
| Code protection | esbuild minification | Obfuscated .min.js output for npm publishing |
| `--load-extension` | Auto-load extension | No manual install step, works in Chrome 148+ |
| Hard lock | Full-page overlay | Prevents race conditions between AI and user |
| Explicit stop only | No idle timeout | AI controls lifecycle, keeps session warm |
| Session state in server | In-memory | Simple for testing, no persistence needed |
| PID file at config dir | `~/.browser-pilot/server.pid` | Survives project directory changes |
| chrome-devtools-mcp as dependency | Regular dependency | Single `npm install` gets everything |
| Separate Chrome profile | `~/.browser-pilot/chrome-profile/` | Isolated from user's everyday Chrome |

## References

- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [chrome-devtools-mcp](https://www.npmjs.com/package/chrome-devtools-mcp)
- [Chrome Extension MV3](https://developer.chrome.com/docs/extensions/develop/migrate)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Antigravity Browser Automation Research](https://alokbishoyi.com/blogposts/reverse-engineering-browser-automation.html)
