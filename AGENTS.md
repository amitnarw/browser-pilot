# Web MCP — Agent Context

This file provides critical context for AI agents working on the Web MCP project. Read this first before making any changes.

## 🔴 CRITICAL: AI Behavior Rules (READ IMMEDIATELY)

**1. NEVER Manually Start Chrome**: You MUST NOT run commands like `start chrome` or `chrome.exe` in powershell. The `web-mcp` MCP tools (like `browser_navigate`) will automatically launch Chrome for you if it is not running. 
**2. NEVER Use `taskkill` on Chrome**: You MUST NOT run commands like `taskkill /f /im chrome.exe`. This kills the user's personal browsing sessions. If you absolutely must clean up stale processes, ONLY use the specific `Get-CimInstance` powershell commands listed below under "Kill All Stale Processes".
**3. NEVER Try to Fix the Port**: If port 9222 is busy or Chrome fails to connect, do NOT try to kill all chromes or change the port manually. Report the error to the user or use the designated cleanup commands.
**4. NO CHEATING - SIMULATE REAL USERS**: The purpose of this tool is to test website functionality like a real user. You MUST NOT use `browser_navigate` to jump directly to internal pages or cheat by typing direct URLs. Use `browser_navigate` ONLY for the initial entry point, and then rely strictly on `browser_click`, `browser_type`, etc., to navigate the site.

## 🔴 CRITICAL: Extension Reload Requirement

**After EVERY code change to the extension, you MUST reload it in Chrome.**

Chrome "Load unpacked" extensions **do NOT auto-update** when files change.

### Reload Steps
1. Go to `chrome://extensions` in the AI-controlled Chrome window
2. Find **Web MCP**
3. Click the **↻ reload icon** (circular arrow)
4. **Refresh the page** (F5) where you want the sidebar to appear

### Rebuild + Reload Command
```powershell
cd "D:\amit\web-mcp"
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
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*web-mcp*" -or $_.CommandLine -like "*chrome-devtools*" } | Stop-Process -Force

# Kill Chrome with web-mcp profile
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*web-mcp*" } | Stop-Process -Force
```

### Clear Extension Cache
Chrome caches extension files in the profile. Old content.js may persist.
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.web-mcp\chrome-profile\Default\Extensions"
Remove-Item -Recurse -Force "$env:USERPROFILE\.web-mcp\chrome-profile\extensions_crx_cache"
```

## Sidebar Not Visible? Checklist

| Step | Check | Command |
|------|-------|---------|
| 1 | Server running? | `Invoke-RestMethod "http://localhost:3026/sidebar/state"` |
| 2 | `active: true`? | Should show `active: true` in response |
| 3 | Chrome on 9222? | `Invoke-RestMethod "http://127.0.0.1:9222/json/version"` |
| 4 | Extension reloaded? | Go to `chrome://extensions` → click ↻ reload |
| 5 | Content script injected? | F12 → Console → `document.getElementById("web-mcp-sidebar")` |
| 6 | Console errors? | F12 → Console → look for `[Web MCP]` logs |

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
**Fix:** Removed all JavaScript capture listeners. CSS overlay with `pointer-events: auto` already blocks user mouse/touch interactions naturally. BUT we re-added them to block keyboard inputs, see fix 10.

### 9. Content.js Simplified
**Problem:** 340px embedded sidebar panel was complex and conflicted with native side panel.
**Fix:** Content script now injects:
- Full-page transparent overlay (blocks page interaction while AI active)
- Status bar at bottom-right: dot + "Web MCP" + task name + "Take Control" + "Open full →"
- Idle badge when session inactive
- "Open full →" opens native side panel

### 10. Isolated World Boundary for AI Acting Flag
**Problem:** To allow CDP clicks to pass through the JS event blockers, we injected `window.__bp_ai_acting = true` into the page via CDP. But `content.js` runs in an Isolated World and couldn't see this flag, so it continued blocking AI clicks.
**Fix:** Switched to using a shared DOM attribute (`document.documentElement.setAttribute('data-bp-ai-acting', 'true')`) which can be read across context boundaries.

### 11. The Zombie Blocker (try/finally)
**Problem:** The `data-bp-ai-acting` flag was set before a CDP action and removed afterward. If the CDP action threw an error (e.g. element not found), the flag was never removed. The JS blockers stayed permanently disabled, destroying the security boundary.
**Fix:** Wrapped the CDP action execution in a strict `try/finally` block to guarantee the flag is always removed.

### 12. The Unstoppable AI (ensureBrowserReady Short-Circuit)
**Problem:** When the user clicked "Halt", the local server stopped the session. But if the AI was stuck in a tight loop calling tools, its local `wrapper.ts` state remained "running". `ensureBrowserReady()` returned `true` immediately without pinging the server to check for the halt. The AI essentially ignored the Halt button and instantly took control back.
**Fix:** Moved the server health check (which looks for `lastUserHaltTime` < 10 seconds) directly into `callChromeDevtoolsTool` before ANY short-circuits. If the user halted recently, it throws a fatal error, forcing the AI to stop its loop immediately.

### 13. The CDP keyup Race Condition
**Problem:** When typing text and pressing Enter (`submitKey=Enter`), Google Search would not submit. This happened because `wrapper.ts` removed the `data-bp-ai-acting` flag *immediately* after the CDP `press_key` call completed. However, the browser's event queue processes the `keyup` event asynchronously. Because the flag was already gone, `content.js` intercepted the `keyup` event and called `e.preventDefault()`, which prevented Google's React logic from seeing the Enter key release and submitting the form.
**Fix:** Added a 100ms `await sleep(100)` delay before removing the `data-bp-ai-acting` flag, giving the browser's DOM event queue enough time to process trailing `keyup` and React synthetic events before the human-blocker re-engages.

### 14. The CDP MouseEvent Hit-Testing Race Condition
**Problem:** AI clicks (`browser_click`) were silently failing, but `browser_type` still typed text into the void. `wrapper.ts` set the `data-bp-ai-acting = true` flag (which sets the blocking overlay to `pointer-events: none`) *immediately* before dispatching the CDP click. The browser did not have time to recalculate the CSS/layout tree before the CDP click arrived, meaning hit-testing still saw the overlay as `pointer-events: auto`. The overlay swallowed the click, stealing focus from auto-focused inputs.
**Fix:** Swapped the order of execution. `wrapper.ts` now sets the flag, forces a synchronous layout flush (`document.documentElement.offsetHeight`), and *then* sleeps for 500ms *before* dispatching the CDP click. This guarantees the hit-testing tree is updated before the click arrives.

### 15. The Silent evaluate_script Failure
**Problem:** Even after fixing the layout flush, clicks still hit the overlay. `wrapper.ts` was passing `{ script: "..." }` to the MCP tool `evaluate_script`. However, the `chrome-devtools-mcp` package expects `{ function: "() => { ... }" }`. Because the argument was named wrong, `evaluate_script` silently executed `(undefined)()`, never actually setting the `data-bp-ai-acting` flag at all! This left the `pointer-events: auto` overlay permanently active, completely blinding the AI to any click interactions.
**Fix:** Refactored `wrapper.ts` to pass the correct parameter `{ function: "() => { ... }" }` to `evaluate_script`, permanently fixing the AI's ability to click elements.

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
D:\amit\web-mcp\
├── src/
│   ├── mcp/wrapper.ts          # MCP server, 21 browser tools
│   ├── server/server.ts        # HTTP server, session/sidebar state
│   ├── server/logger.ts        # Persistent file logger with rotation
│   └── extension/              # SOURCE FILES: Edit extension code here!
│       ├── manifest.json       # Chrome extension manifest
│       ├── service_worker.js   # SSE client, broadcasts LOCK_STATE
│       ├── content.js          # Blocking overlay + status bar
│       ├── popup.html          # Extension popup UI
│       ├── popup.js            # Popup logic
│       ├── sidepanel.html      # Native side panel (real-time via SSE)
│       └── sidepanel.js        # Side panel SSE client + DOM updates
├── extension/                  # BUILD OUTPUT: Minified extension files (Do not edit)
├── dist/                       # BUILD OUTPUT: Compiled server files (Do not edit)
│   ├── mcp/wrapper.min.js
│   ├── server/server.min.js
│   └── server/logger.min.js
└── AGENTS.md                   # This file
```

## Common Commands

```powershell
# Rebuild everything
cd "D:\amit\web-mcp"; npm run build; npm run bundle

# Check server state
Invoke-RestMethod "http://localhost:3026/sidebar/state" | ConvertTo-Json

# Get debug info
Invoke-RestMethod "http://localhost:3026/debug" | ConvertTo-Json -Depth 3

# Get server logs
Invoke-RestMethod "http://localhost:3026/logs" | ConvertTo-Json -Depth 2

# Start server manually
node "D:\amit\web-mcp\dist\server\server.min.js"

# Check Chrome remote debugging
Invoke-RestMethod "http://127.0.0.1:9222/json/version" | ConvertTo-Json

# Kill all Web MCP processes
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*web-mcp*" -or $_.CommandLine -like "*chrome-devtools*" } | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*web-mcp*" } | Stop-Process -Force

# Get server logs (persistent file)
Get-Content "$env:USERPROFILE\.web-mcp\logs\server.log" -Tail 20
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
- **Server logs** at `~/.web-mcp/logs/server.log` — 10MB rotation, 7 files kept