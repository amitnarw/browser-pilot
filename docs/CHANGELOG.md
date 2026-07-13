# Changelog

All notable changes to `@amitnarw/web-mcp`.

## 0.1.6

- Renamed remaining `browser-pilot` references to `web-mcp`.
- Rewrote README and documentation in plain, beginner-friendly language.
- Added public docs folder at `docs/`.
- Added npm keywords for discoverability.
- Removed tracked `.tgz` build artifacts from the repo.
- Moved source code to the private `private` branch.
- Demo image updated to point to new repo URL.

## 0.1.5

- Updated configuration paths for OpenCode, Cursor, Claude, Windsurf, Zed, Cody, Cline, and OpenAI Codex.
- Improved atomic file writes for AI client config files.
- Removed old code and cleaned up the codebase.

## 0.1.4

- Fixed CDP hit-testing so AI clicks land on the right element.
- Fixed silent `evaluate_script` failures by correctly passing function parameters.
- General stability improvements and bug fixes.

## 0.1.3

- Added stealth mode: replaced `--enable-automation` with `--disable-blink-features=AutomationControlled` to avoid detection.
- Fixed interactive browser launch freeze.
- Added dynamic import of Puppeteer for better compatibility.
- Added OpenAI Codex integration support.

## 0.1.2

- Multi-agent orchestration safety fixes.
- Extension auto-cleanup on shutdown.
- Stale process cleanup and port hijack prevention.
- SSE event stream reliability improvements.

## 0.1.1

- Heartbeat mechanism to prevent zombie Chromium processes when the AI disconnects.
- Sidebar active state and content script fixes for lock overlay.
- Initial concurrency safety work for multiple AI agents.

## 0.1.0

- First public release.
- MCP server with full browser control tools (navigate, click, type, scroll, screenshot, and more).
- Dedicated Chromium profile and extension for isolated browsing.
- Human-AI collision protection with DOM overlay.
- Multi-agent concurrency support.
- Extension side panel with real-time action feed.
- Support for OpenCode, Cursor, Claude Desktop, Claude Code, Windsurf, Zed, Cody, Cline, and Codex.
