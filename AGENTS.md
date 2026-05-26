# BrowserPilot — Agent Context

This file provides critical context for AI agents working on the BrowserPilot project. Read this first before making any changes.

## 🔴 CRITICAL: Extension Reload Requirement

**After EVERY code change to the extension, you MUST reload it in Chrome.**

Chrome "Load unpacked" extensions **do NOT auto-update** when files change.

### Reload Steps
1. Go to `chrome://extensions` in the AI-controlled Chrome window
2. Find **BrowserPilot**
3. Click the **↻ reload icon** (circular arrow)
4. **Refresh the page** (F5) where you want the sidebar to appear

### Rebuild + Reload Command
```powershell
cd "D:\amit\browser-pilot"
npm run build
npm run bundle
```
Then reload the extension in Chrome.

## Process Lifecycle

```
OpenCode Chat → Spawns Wrapper (node wrapper.min.js)
                    ├── Starts Server (port 3026) — LONG LIVED
                    ├── Launches Chrome (port 9222) — LONG LIVED
                    └── Connects to chrome-devtools-mcp
                        
Wrapper dies → Server + Chrome may SURVIVE as orphans
```

**Key rule:** When the wrapper dies (chat ends, crashes), child processes may stay alive. This causes port conflicts on next run.

### Kill All Stale Processes
```powershell
# Kill wrapper + server + Chrome processes
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*browser-pilot*" -or $_.CommandLine -like "*chrome-devtools*" } | Stop-Process -Force

# Kill Chrome with browser-pilot profile
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*browser-pilot*" } | Stop-Process -Force
```

### Clear Extension Cache
Chrome caches extension files in the profile. Old content.js may persist.
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.browser-pilot\chrome-profile\Default\Extensions"
Remove-Item -Recurse -Force "$env:USERPROFILE\.browser-pilot\chrome-profile\extensions_crx_cache"
```

## Sidebar Not Visible? Checklist

| Step | Check | Command |
|------|-------|---------|
| 1 | Server running? | `Invoke-RestMethod "http://localhost:3026/sidebar/state"` |
| 2 | `active: true`? | Should show `active: true` in response |
| 3 | Chrome on 9222? | `Invoke-RestMethod "http://127.0.0.1:9222/json/version"` |
| 4 | Extension reloaded? | Go to `chrome://extensions` → click ↻ reload |
| 5 | Content script injected? | F12 → Console → `document.getElementById("browser-pilot-sidebar")` |
| 6 | Console errors? | F12 → Console → look for `[BrowserPilot]` logs |

## Key Fixes Applied (May 2026)

### 1. Sidebar Activation Order Fix
**Problem:** `ensureSidebarActive()` was called BEFORE `startServer()` → silently failed because server wasn't running.
**Fix:** Moved `ensureSidebarActive()` to AFTER server is confirmed healthy.

### 2. Sidebar Active State Fix
**Problem:** `ensureBrowserReady()` returned early if `chromeDevtoolsClient` existed but `sidebarActive` was false.
**Fix:** Added `&& sidebarActive` to the early return condition.

### 3. Content Script Deduplication
**Problem:** Service worker polled every 2 seconds, content script called `removeOverlay()` repeatedly causing infinite log spam.
**Fix:** Added `lastActiveState` tracking — only acts when state actually changes.

### 4. Extension Cache Auto-Clear
**Problem:** Chrome cached old extension files (content.js with broken sidePanel.open()).
**Fix:** `launchChrome()` now deletes `Default/Extensions/` and `extensions_crx_cache/` before launch.

### 5. Stale Process Cleanup
**Problem:** Wrapper crashes left server + Chrome running as orphans.
**Fix:** Added `killStaleServer()` before starting new server + heartbeat check every 30 seconds.

### 6. fetchWithTimeout Bug Fix
**Problem:** `fetchWithTimeout()` in wrapper.ts was dropping `method`/`headers`/`body` options — all POST requests became GETs, returning HTML 404. Session never started, sidebar never activated.
**Fix:** Now passes `options` via `{ ...options, signal: AbortSignal.timeout() }`.

### 7. submitKey Unreliable in chrome-devtools-mcp
**Problem:** Passing `submitKey` to chrome-devtools-mcp's `type_text` tool didn't reliably press the key after typing.
**Fix:** `browser_type` now calls `type_text` first, then calls `press_key` separately if `submitKey` is provided.

### 8. JavaScript Capture Listeners Blocked AI Tool Events
**Problem:** Content.js added capture-phase listeners on `document` for `click`, `keydown`, etc. that called `e.stopPropagation()` + `e.preventDefault()`. This blocked ALL events — including CDP-dispatched events from AI tools (click, type, press_key). Attempted `isTrusted` check but CDP's `Input.dispatchMouseEvent/Key` creates trusted events (isTrusted=true).
**Fix:** Removed all JavaScript capture listeners. CSS overlay with `pointer-events: auto` already blocks user mouse/touch interactions naturally.

### 9. Content.js Simplified
**Problem:** 340px embedded sidebar panel was complex and conflicted with native side panel.
**Fix:** Content script now injects:
- Full-page transparent overlay (blocks page interaction while AI active)
- Status bar at bottom-right: dot + "BrowserPilot" + task name + "Take Control" + "Open full →"
- Idle badge when session inactive
- "Open full →" opens native side panel

## How It Works (End-to-End Flow)

1. **User asks AI:** `"go to google and search for phone"`
2. **AI calls `browser_navigate`** → `callChromeDevtoolsTool()`
3. **`ensureBrowserReady()`** runs:
   - Starts server on port 3026 (if not running)
   - Launches Chrome with extension on port 9222 (if not running)
   - Calls `/session/start` → sets `lockOwner: "agent"`
   - Calls `/sidebar/start` → sets `active: true`
   - Connects to chrome-devtools-mcp
4. **Server broadcasts** `active: true` via SSE (`/events` endpoint)
5. **Extension service worker** receives SSE event instantly (0ms delay)
6. **Content script** receives `LOCK_STATE` message → shows blocking overlay + status bar
7. **Status bar** appears at bottom-right (dot + task name + "Take Control" + "Open full →")
8. **AI tool executes** (navigate, click, type, etc.)
9. **Actions appear** in status bar in real-time via SSE push
10. **AI calls `browser_done`** → overlay hides, lock released, session stays alive (ready)
11. **90-second idle timeout** auto-closes sidebar if AI forgets `browser_done`

## File Structure

```
D:\amit\browser-pilot\
├── src/
│   ├── mcp/wrapper.ts          # MCP server, 21 browser tools
│   ├── server/server.ts        # HTTP server, session/sidebar state
│   └── server/logger.ts        # Persistent file logger with rotation
├── extension/
│   ├── manifest.json             # Chrome extension manifest
│   ├── service_worker.js        # SSE client, broadcasts LOCK_STATE
│   ├── content.js               # Blocking overlay + status bar
│   ├── popup.html               # Extension popup UI
│   ├── popup.js                 # Popup logic
│   ├── sidepanel.html           # Native side panel (real-time via SSE)
│   └── sidepanel.js             # Side panel SSE client + DOM updates
├── dist/                        # Compiled + minified output
│   ├── mcp/wrapper.min.js
│   ├── server/server.min.js
│   └── server/logger.min.js
└── AGENTS.md                    # This file
```

## Common Commands

```powershell
# Rebuild everything
cd "D:\amit\browser-pilot"; npm run build; npm run bundle

# Check server state
Invoke-RestMethod "http://localhost:3026/sidebar/state" | ConvertTo-Json

# Get debug info
Invoke-RestMethod "http://localhost:3026/debug" | ConvertTo-Json -Depth 3

# Get server logs
Invoke-RestMethod "http://localhost:3026/logs" | ConvertTo-Json -Depth 2

# Start server manually
node "D:\amit\browser-pilot\dist\server\server.min.js"

# Check Chrome remote debugging
Invoke-RestMethod "http://127.0.0.1:9222/json/version" | ConvertTo-Json

# Kill all BrowserPilot processes
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*browser-pilot*" -or $_.CommandLine -like "*chrome-devtools*" } | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*browser-pilot*" } | Stop-Process -Force

# Get server logs (persistent file)
Get-Content "$env:USERPROFILE\.browser-pilot\logs\server.log" -Tail 20
```

## Debug Logging

### In Extension UI
- **Popup**: Click "Show Debug Logs" to see real-time server logs
- **Side Panel**: Click "Show Debug Logs" at the bottom to see real-time server logs
- Both poll `/debug` endpoint every 2 seconds when visible

### Via API
```powershell
# Get comprehensive debug info
Invoke-RestMethod "http://localhost:3026/debug" | ConvertTo-Json -Depth 3

# Get just the logs
Invoke-RestMethod "http://localhost:3026/logs" | ConvertTo-Json -Depth 2
```

### Wrapper Logging
The wrapper logs every step of `ensureBrowserReady()`:
- `[ensureBrowserReady] Called. isInitializing=X session.status=X chromeDevtoolsClient=X sidebarActive=X`
- `[ensureBrowserReady] Server healthy: true/false`
- `[ensureBrowserReady] Chrome healthy: true/false`
- `[ensureBrowserReady] /session/start response: {...}`
- `[ensureBrowserReady] sidebarActive=X — calling ensureSidebarActive if false...`
- `[ensureSidebarActive] Calling /sidebar/start with taskName: X`
- `[ensureSidebarActive] Response: {...}`
- `[ensureBrowserReady] Browser ready ✓`

These logs appear in the OpenCode terminal (stderr) when running the wrapper.

## Important Notes

- **Never call `browser_start`** — it's marked "INTERNAL TOOL — DO NOT CALL"
- **"Take Control" button** removes overlay locally, doesn't affect server state
- **chrome-devtools-mcp connection** is non-fatal — sidebar works without it
- **Extension must be reloaded** after every code change — this is the #1 cause of "sidebar not visible"
- **Server is independent** of wrapper — survives wrapper crashes
- **Chrome is independent** of wrapper — user can close it manually
- **`browser_done`** signals task completion — AI should call it when done (90s idle timeout as fallback)
- **CSS overlay** with `pointer-events: auto` blocks user mouse/touch — no JS capture listeners needed
- **`isTrusted` does NOT work** for CDP events — `Input.dispatchMouseEvent/Key` creates trusted events
- **Server logs** at `~/.browser-pilot/logs/server.log` — 10MB rotation, 7 files kept