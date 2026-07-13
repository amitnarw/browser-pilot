# Web MCP - Development Guide

## 🔴 CRITICAL NOTE
**We exclusively use a managed Chromium binary (via Puppeteer).** Modern Google Chrome blocks unpacked extensions, so the project relies entirely on downloading and launching a dedicated Chromium instance.

## Project Overview

Web MCP is an npm package that gives AI agents (via OpenCode) full browser 
automation control with a real-time activity sidebar. It uses MCP (Model Context 
Protocol) to expose browser tools that AI models can call autonomously.

**Key idea:** The AI decides when to open/close Chromium. The extension auto-loads. 
The sidebar shows what the AI is doing in real-time. The user can't interfere while 
the AI is controlling the browser (hard lock).

## User Experience

```powershell
# Install (one command)
npm install -g @amitnarw/web-mcp

# Setup (one command)
web-mcp setup

# Use (just run OpenCode)
opencode
# AI has full browser control — opens/closes Chromium, navigates, clicks, types
# Sidebar shows real-time activity
# User can't interfere while AI is controlling
```

## Architecture

```
OpenCode
  └── MCP Wrapper (dist/mcp/wrapper.min.js)
        ├── Always registered (visible to AI from start):
        │   ├── browser_start          — Start Chromium + server (optional)
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
    → Checks Chromium health → auto-launches if needed
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
  → Kills Chromium, kills server
  → Resets all state
  → Session: ready → closing → idle
```

## What Was Done (Completed)

### npm Package Structure
- Unified `package.json` with `bin`, `files`, `dependencies`
- `"type": "module"` for ESM output
- `tsconfig.json` with `"module": "Node16"` for proper ESM
- `bin/web-mcp.js` — CLI entry point (thin wrapper, dynamic imports)
- `scripts/bundle.mjs` — esbuild bundler for obfuscated `.min.js` output
- `.gitignore`, `.npmignore` for clean publishing

### CLI Commands
- `web-mcp setup` — Creates `~/.web-mcp/` dir, config.json, adds MCP entry to OpenCode config
- `web-mcp stop` — Kills server (by PID file) + Chromium (by profile args)
- `web-mcp status` — Checks server health, Chromium health, OpenCode config

### MCP Wrapper (`src/mcp/wrapper.ts`)
- **Static tool registration** — All 20 browser tools registered at startup, visible to AI immediately
- **`ensureBrowserReady()` pattern** — Auto-starts server + Chromium + chrome-devtools-mcp on first tool call
- **`callChromeDevtoolsTool()` helper** — Handles session state, sidebar logging, and chrome-devtools-mcp delegation
- `browser_start` tool — Explicit start (optional, auto-start handles it)
- `browser_stop` tool — Stops Chromium + server, resets state
- `browser_get_status` tool — Returns session state
- 17 high-level browser tools — navigate, click, type, fill, scroll, screenshot, snapshot, press_key, wait, evaluate, new_tab, close_tab, switch_tab, get_tabs, get_url, hover, drag
- Cleanup on exit (kills server/Chromium if we started them)
- `fetchWithTimeout` bug fix — method/headers/body were dropped, making all POSTs into GETs
- `submitKey` fix — now calls `press_key` separately (chrome-devtools-mcp's type_text submitKey unreliable)
- `browser_done` tool — signals task completion, hides overlay, releases lock
- 90-second idle timeout — auto-closes sidebar if AI forgets `browser_done`
- Tool descriptions updated — all browser tools tell AI to call `browser_done` when done
- **Multi-client safe orchestration** — `browser_stop` and `cleanup()` no longer hard-kill the shared server/Chromium processes, allowing multiple AIs to safely share the singleton backend.
- **Strict Port Hijack safety** — `ensureBrowserReady()` strictly checks for the extension `service_worker` and fatally crashes if it's missing (prevents hijacking unprotected Chromium windows).
- **Atomic File JSON Safety** — `config.json` and `env.js` writes are now perfectly atomic via `.tmp` and `fs.renameSync`.
- **Bulletproof hit-testing** — Switched `sleep(500)` to `requestAnimationFrame` for lightning-fast, guaranteed CDP layout flushes.

### Coordination Server (`src/server/server.ts`)
- Express HTTP server on port 3026
- Session state management (idle/launching/ready/running/waiting/closing)
- Lock state management (agent/user/null)
- Session endpoints: `/session/start`, `/session/stop`, `/session/lock`, `/session/state`
- Sidebar endpoints: `/sidebar/start`, `/sidebar/end`, `/sidebar/action`, `/sidebar/state`
- Health endpoints: `/ping` endpoint added to cleanly differentiate between stale PID files and live servers.
- PID file at `~/.web-mcp/server.pid` (supplemented by OS-level `Get-NetTCPConnection`/`lsof` port checks).
- Recordings at `~/.web-mcp/recordings/`
- `server/logger.ts` — Persistent file logger with 10MB rotation, 7 files kept at `~/.web-mcp/logs/server.log`

### Chromium Extension
- `manifest.json` — MV3, permissions: sidePanel, tabs, activeTab
- `service_worker.js` — SSE client with periodic reconnection, broadcasts LOCK_STATE to tabs. Now includes a **heartbeat monitor**: pings the local server every 3s and automatically self-destructs (closes all Chromium windows) if the server goes offline for >60s, preventing "Zombie Chromium" memory leaks.
- `content.js` — Blocking overlay with Hover.dev-style ambient light sweep + centered status bar. CSS `pointer-events: auto` blocks user mouse/touch. No JS capture listeners (they blocked AI tool events from CDP). Status bar shows: animated standard orb + status text + "Open Sidebar" + "Stop" buttons.
- `sidepanel.html/js` — Dark-themed activity feed with active task card and dune-wind gradient.
- `popup.html/js` — Status popup

### Configuration Files by Client
- **Web MCP Config**: `~/.web-mcp/config.json` — Configures local coordinate server and browser settings.
- **OpenCode**: `~/.config/opencode/opencode.json` with `mcp` key (`type: "local"`, `command` array). Also detects legacy `~/.opencode.json`.
- **Claude Desktop**: macOS (`~/Library/Application Support/Claude/claude_desktop_config.json`), Windows Roaming (`~/AppData/Roaming/Claude/claude_desktop_config.json`), Linux (`~/.config/Claude/claude_desktop_config.json`). `mcpServers` key with `type: "stdio"`, `command: "npx"`, `args`.
- **Claude Code (CLI)**: `~/.claude.json` (user-scoped MCP, per Anthropic docs). Also detects legacy `~/.claude/settings.json`.
- **Cursor**: `~/.cursor/mcp.json`, `mcpServers` key.
- **Windsurf**: `~/.codeium/windsurf/mcp_config.json`, `mcpServers` key.
- **Zed Editor**: Windows Roaming (`~/AppData/Roaming/Zed/settings.json`), macOS (`~/Library/Application Support/Zed/settings.json`), Linux (`~/.config/zed/settings.json`). Configured under the `context_servers` JSON key.
- **Sourcegraph Cody**: Windows Roaming (`~/AppData/Roaming/Code/User/globalStorage/sourcegraph.cody-ai/mcp_servers.json`), macOS (`~/Library/Application Support/Code/User/globalStorage/sourcegraph.cody-ai/mcp_servers.json`), Linux (`~/.config/Code/User/globalStorage/sourcegraph.cody-ai/mcp_servers.json`).
- **Cline**: `~/.cline/data/settings/cline_mcp_settings.json`, `mcpServers` key.
- **OpenAI Codex**: `~/.codex/config.toml` (TOML format) and auto-generated instructions at `~/.codex/web-mcp-instructions.md` via the `model_instructions_file` configuration directive.
- **Antigravity IDE**: `~/.gemini/antigravity/mcp_config.json`.
- **ChatGPT Desktop**: Manually configured bridge connection via settings.

## What Is Pending

### Not Yet Implemented
1. **Chrome Web Store publication** — Extension should be published for clean install (no developer mode banner warnings).
2. **Step-level locking** — Currently, hard lock is applied during the entire session; could unlock between steps.
3. **Session recordings playback** — Action recordings are saved but there is no UI to replay them.
4. **Multi-tab awareness** — Sidebar could show which tab is being controlled.

### Technical Debt
1. **No tests** — Unit or integration tests do not yet exist.
2. **chrome-devtools-mcp spawn** — Currently uses `npx chrome-devtools-mcp`. Could use a direct relative binary path or imported module.

## File Structure

```
d:\amit\web-mcp\
├── bin/
│   └── web-mcp.js          # CLI entry point (ESM, dynamic imports)
├── src/
│   ├── cli/
│   │   ├── browser.ts            # Launches browser with DevMode and profile configuration
│   │   ├── interactive.ts        # Interactive command menu system
│   │   ├── orb.ts                # Visual terminal orb tracking orb
│   │   ├── setup.ts              # Configuration setups for all AI clients
│   │   ├── status.ts             # Status diagnostics checking
│   │   ├── stop.ts               # Processes termination (SIGTERM/kill)
│   │   └── troubleshoot.ts       # Environment cleaner and troubleshooter
│   ├── server/
│   │   ├── server.ts             # Express HTTP server (port 3026)
│   │   └── logger.ts             # Persistent file logger with rotation
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
├── extension/                    # Chromium extension (Manifest V3)
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
- Lines 228-255: Chromium detection (findChromePath)
- Lines 257-316: Server management (startServer)
- Lines 318-387: Chromium management (launchChrome — with --load-extension)
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

### wrapper.ts — Key Fixes
- `fetchWithTimeout()` — Fixed to pass method/headers/body options (was dropping them)
- `browser_done` tool — Signals task completion, hides overlay, releases lock
- 90-second idle timeout — Auto-closes sidebar if no tool calls for 90 seconds
- `submitKey` fix — Calls `press_key` separately after `type_text`

### server.ts — HTTP Server
- Lines 1-47: Imports, interfaces, constants
- Lines 49-90: State, recordings dir, PID file, logging
- Lines 92-137: Session management (startSession, endSession, recordCommand)
- Lines 139-180: HTTP setup, CORS, identity, status endpoints
- Lines 182-230: Session endpoints (start, stop, lock, state)
- Lines 232-280: Sidebar endpoints (start, end, action, state)
- Lines 282-362: Sessions history, server listen, graceful shutdown

### content.js — Blocking Overlay + Hover.dev Ambient Light
- Creates full-page transparent overlay div with `pointer-events: auto`
- Injects a dual-layer, 4-second rotating conic-gradient (a sharp 2px border trace + a heavily blurred inner glow) to create a ambient light sweep.
- CSS overlay blocks user mouse/touch interactions (no JS capture listeners)
- Status bar centered at bottom (`bp-action-bar-root`): standard tracking orb + status text + "Open Sidebar" button + "Stop" button.
- "Stop" button opens a halt dialog.
- "Open Sidebar" button sends a message to open the native side panel.
- Listens for LOCK_STATE messages from service worker
- Checks initial state on load (with 4-second retry for race conditions)

## Configuration Files

### ~/.web-mcp/config.json
```json
{
  "server": { "port": 3026 },
  "chrome": { 
    "port": 9222, 
    "executable": "auto-detect",
    "profileDir": "~/.web-mcp/chromium-profile-v2"
  },
  "logging": { "level": "info" }
}
```

### ~/.config/opencode/opencode.json (OpenCode Configuration)
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "web-mcp": {
      "type": "local",
      "command": ["npx", "-y", "@amitnarw/web-mcp", "mcp"],
      "enabled": true
    }
  }
}
```

### ~/.codex/config.toml (OpenAI Codex Configuration)
```toml
model_instructions_file = "C:/Users/admin/.codex/web-mcp-instructions.md"

[mcp_servers.web-mcp]
command = "npx"
args = ["-y", "@amitnarw/web-mcp", "mcp"]
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
node bin/web-mcp.js setup
node bin/web-mcp.js status
node bin/web-mcp.js stop

# Install globally from local dir
npm install -g .

# Uninstall global
npm uninstall -g @amitnarw/web-mcp

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
2. No build step needed — Chromium loads them directly
3. Reload extension in Chromium: `chrome://extensions/` → click reload icon

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
| `--load-extension` | Auto-load extension | No manual install step, works in Chromium 148+ |
| Hard lock | Full-page overlay | CSS `pointer-events: auto` blocks mouse/touch; no JS listeners (blocked AI tools) |
| 90-second idle timeout | Auto-close sidebar | Safety fallback if AI forgets `browser_done` |
| `browser_done` tool | Explicit completion signal | AI tells us when work is done; overlay hides, lock released |
| CSS-only blocking | pointer-events:auto | JS capture listeners blocked CDP events (trusted); CSS overlay is sufficient |
| Session state in server | In-memory | Simple for testing, no persistence needed |
| PID file at config dir | `~/.web-mcp/server.pid` | Survives project directory changes |
| chrome-devtools-mcp as dependency | Regular dependency | Single `npm install` gets everything |
| Separate Chromium profile | `~/.web-mcp/chromium-profile/` | Isolated from user's everyday Chromium |

## References

- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [chrome-devtools-mcp](https://www.npmjs.com/package/chrome-devtools-mcp)
- [Chromium Extension MV3](https://developer.chrome.com/docs/extensions/develop/migrate)
- [Chromium Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Antigravity Browser Automation Research](https://alokbishoyi.com/blogposts/reverse-engineering-browser-automation.html)
