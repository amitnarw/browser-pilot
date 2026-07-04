# Web MCP — Project State & Handover Reference (v0.1.5)

This document provides a clean, comprehensive summary of the current state of **Web MCP** (published as `@amitnarw/web-mcp`). 

---

## 1. Version 0.1.5 Overview

Web MCP is fully updated, packaged, and published under the scoped name `@amitnarw/web-mcp`. All core functionality, interactive CLI tools, coordinate servers, and browser extensions are stable.

### Key Releases & Fixes:
1. **Stealth Mode / CAPTCHA Bypass**: Replaced `--enable-automation` with `--disable-blink-features=AutomationControlled` across both the browser manager and the main MCP wrapper to prevent Google and standard web sites from flagging and blocking automated actions.
2. **Asynchronous Browser Kill**: In `src/cli/browser.ts`, the process cleanups (`wmic` on Windows, `pkill` on macOS/Linux) have been made asynchronous and unreferenced (`spawn(..., { detached: true }).unref()`) to eliminate the interface freeze observed in earlier versions.
3. **PowerShell Pipeline Process Cleanups**: Fixed the pipeline syntax for killing stale processes across Windows environments. It now correctly maps process IDs and prevents hidden failures:
   `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { ... } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
4. **OpenAI Codex Integration**: Added support for Codex configuration in `config.toml` along with automatic generation of a custom instructions document at `~/.codex/web-mcp-instructions.md`. This instructions file contains system rules instructing the Codex LLM to always select Web MCP tools over its built-in browser engine.
5. **Config Path Refactoring**: Standardized configuration directories, paths, and JSON key structures for all major AI clients (OpenCode, Claude Desktop, Claude Code, Cursor, Windsurf, Zed, Cody, Cline, Codex, Antigravity).

---

## 2. Supported Clients Configuration Matrix

The `web-mcp setup` script automates configuration injection across the following platforms:

| Client | Primary Configuration Path | Key/Block Used | Notes |
| :--- | :--- | :--- | :--- |
| **OpenCode** | `~/.config/opencode/opencode.json` | `mcp["web-mcp"]` | `type: "local"`, `command` array |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` | `mcpServers["web-mcp"]` | OS-specific paths mapped automatically |
| **Claude Code** | `~/.claude.json` | `mcpServers["web-mcp"]` | Falls back to `~/.claude/settings.json` |
| **Cursor** | `~/.cursor/mcp.json` | `mcpServers["web-mcp"]` | |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | `mcpServers["web-mcp"]` | |
| **Zed Editor** | `~/Library/Application Support/Zed/settings.json` | `context_servers["web-mcp"]` | Roaming AppData mapped for Windows |
| **Cody** | `~/Library/Application Support/Code/User/globalStorage/sourcegraph.cody-ai/mcp_servers.json` | `mcpServers["web-mcp"]` | Windows paths resolved under Roaming |
| **Cline** | `~/.cline/data/settings/cline_mcp_settings.json` | `mcpServers["web-mcp"]` | IDE extension path; CLI uses `~/.cline/mcp.json` |
| **OpenAI Codex** | `~/.codex/config.toml` | `[mcp_servers.web-mcp]` | TOML format; generates model instructions |
| **Antigravity** | `~/.gemini/antigravity/mcp_config.json` | `mcpServers["web-mcp"]` | |
| **ChatGPT Desktop**| Manual Setup | N/A | Connected via local proxy bridge |

---

## 3. Architecture & Process Lifecycle

```
AI Client (e.g. OpenCode)
  └── MCP Wrapper (dist/mcp/wrapper.min.js)
        ├── Express Server (port 3026) [Long-lived]
        ├── Chromium Instance (port 9222) [Long-lived, custom MV3 extension]
        └── chrome-devtools-mcp Client connection
```

* **Heartbeat Monitor**: The extension `service_worker.js` pings the Express server every 3 seconds. If the server is offline or unreachable for more than 60 seconds, the extension automatically closes all browser windows to prevent "zombie" background processes.
* **Shared Singleton Sessions**: The Express server and Chromium instance are independent of individual wrapper sessions. Multiple client windows can safely query and share browser state without causing process collisions or forced kills.
* **Security & Interaction Locks**: The extension injects a full-page transparent overlay with `pointer-events: auto` to block manual user interaction while the agent executes commands. Layout recalculation is forced prior to CDP clicks to guarantee clicks land on correct elements instead of being captured by the overlay.
* **Idle Timeout**: The browser session automatically releases the sidebar lock and overlay if no tool calls are received for 90 seconds.

---

## 4. Troubleshooting & Maintenance Commands

A list of standard diagnostic commands is available in the package:

```powershell
# Clean stale processes, cached profiles, and extensions
web-mcp troubleshoot

# Launch isolated Chromium manually
web-mcp browser

# Check status of server, browser, and configurations
web-mcp status

# Rebuild and bundle source code
npm run build && npm run bundle
```
