# Web MCP Extension Loading Issue - Handover Document

## The Problem
When the AI (via the `chrome-devtools-mcp` wrapper) attempts to launch Chrome, the Web MCP extension is **not loading** into the browser. 
Even when the user navigates to `chrome://extensions` in the newly opened Chrome instance, the extension is completely missing from the list.

The expected behavior is that the Chrome window should launch, the `content.js` script should inject a full-page CSS overlay (`pointer-events: auto`) to block user interaction, and a status bar should appear at the bottom right. None of this happens because the extension itself is never loaded by Chrome.

## Architecture Context
The project (`@amitnarw/web-mcp`) is an MCP server that allows AI agents to control a local Chrome instance.
- **`wrapper.ts`**: The main entry point. It starts an HTTP server (`server.ts`) and spawns a local Chrome instance.
- **Chrome Launch**: `wrapper.ts` uses `child_process.spawn()` to launch Chrome with several flags, crucially:
  - `--remote-debugging-port=9222`
  - `--user-data-dir=C:\Users\admin\.web-mcp\chrome-profile`
  - `--load-extension=C:\Users\admin\.web-mcp\extension`
- **Extension Location**: The built extension files (manifest.json, content.js, service_worker.js, etc.) are copied from the project's `extension/` folder to the user's `C:\Users\admin\.web-mcp\extension` directory right before Chrome is launched.

## What We Have Tried & Fixed So Far

### 1. Stale Cache Issue
- **Hypothesis**: Chrome was aggressively caching old versions of the unpacked extension, preventing new code changes from taking effect.
- **Action Taken**: Modified `wrapper.ts` to forcibly delete the Chrome extension cache directories (`Default/Extensions/` and `extensions_crx_cache/` within the profile directory) before launching Chrome. 
- **Result**: Fixed the caching issue, but the extension still wouldn't load.

### 2. File Corruption in `content.js`
- **Hypothesis**: At one point, the `content.js` file was corrupted with stray characters (e.g., `document.title = 'HACKED BY WEB MCP';`), which caused syntax errors that prevented the extension from executing.
- **Action Taken**: Reverted and cleaned up `content.js`, then properly rebuilt (`npm run build` & `npm run bundle`) the extension. Verified `manifest.json` is perfectly valid JSON.
- **Result**: Code is clean, but Chrome still completely ignores the extension.

### 3. Orphaned Background Processes
- **Hypothesis**: OpenCode spawns the server via `node bin/web-mcp.js mcp`. If the OpenCode chat crashed, the Node server and Chrome processes were left running as orphans. Subsequent requests connected to the *already running* (and broken) Chrome instance, which ignores new `--load-extension` flags.
- **Action Taken**: Wrote PowerShell scripts to reliably kill all stale `node.exe` processes running `web-mcp` and all `chrome.exe` processes running with the test profile.
- **Result**: Ensured a completely fresh launch every time. However, the fresh launch still didn't load the extension.

### 4. Chrome Blacklisting the Extension (Developer Mode)
- **Hypothesis**: The user initially had Developer Mode **OFF** in Chrome. When Chrome was launched with `--load-extension`, Chrome silently disabled the unpacked extension and saved this "disabled" state in the profile's `Preferences` file. Even after Developer Mode was turned ON, Chrome remembered the blacklist.
- **Action Taken**: Completely deleted/renamed the `C:\Users\admin\.web-mcp\chrome-profile` directory to force Chrome to generate a brand new, clean profile. 
- **Result**: The profile was successfully reset, but the extension still did not appear.

### 5. Windows Path Escaping Bug in Chrome CLI
- **Hypothesis**: The path to the extension was `C:\Users\admin\.web-mcp\extension`. We discovered that Chrome's command-line parser on Windows has a bug where it interprets backslashes as escape characters (e.g., `\a` in `\admin`, `\.` in `\.web-mcp`). This caused the `--load-extension` path to be parsed incorrectly, leading Chrome to silently fail to find the directory.
- **Action Taken**: Updated `wrapper.ts` to replace all backslashes with forward slashes (`C:/Users/admin/.web-mcp/extension`).
- **Result**: When testing locally via a separate Node script (`take-screenshot.mjs`), Chrome **successfully loaded the extension** when using forward slashes. However, when the user triggered the AI (which runs through the OpenCode wrapper), the extension **still failed to load**.

## The Real Root Causes & Final Resolution

After deep investigation, we discovered that the issue was actually a combination of several independent problems masking each other.

### 1. Global vs. Local Package Mismatch (The "Invisible Fixes" Problem)
- **Problem**: We were making fixes and rebuilding the project in the development directory (`D:\amit\browser-pilot`). However, the AI MCP server was executing the **globally installed package** (`C:\nvm4w\nodejs\node_modules\@amitnarw\web-mcp`). None of our fixes were actually running.
- **Fix**: Synced the built `dist/` and `extension/` folders from the local dev environment directly into the global `node_modules` directory. Going forward, developers must remember to sync or use `npm link`.

### 2. Chrome Single-Instance Handoff (The "Silent Death" Problem)
- **Problem**: Google Chrome on Windows uses a single-instance model. Because the user's personal Chrome was always open (running with no arguments), whenever `wrapper.ts` tried to spawn an isolated Chrome with `--user-data-dir` and `--load-extension`, Chrome detected the running instance and immediately exited to "hand off" the request. The isolated browser process died within 500ms, meaning port 9222 never opened and the extension never loaded.
- **Fix**: Updated the orphan-process killer in `wrapper.ts` to actively hunt down and `taskkill` **all** Chrome processes (including the user's personal Chrome running without `--type=`) before attempting to launch the isolated session. We also added logic to detect if Chrome dies within 500ms and log a clear warning about single-instance handoff.

### 3. The `--disable-extensions-except` Flag Crash
- **Problem**: In an attempt to force the extension to load, we temporarily added the `--disable-extensions-except` flag. This actually caused Chrome to crash silently ~5-10 seconds after launch.
- **Fix**: Removed the `--disable-extensions-except` flag. `--load-extension` alone is sufficient and stable.

### 4. Corrupted Profile Blacklist
- **Problem**: Because of earlier failed launches (and toggling developer mode), the specific test profile (`chrome-profile`) had permanently blacklisted the extension ID in its `Secure Preferences` file.
- **Fix**: Completely wiped the `~/.web-mcp/chrome-profile` directory, forcing Chrome to generate a truly fresh profile.

### 5. Chrome Anti-Tampering (The "Self-Destructing Preferences" Problem)
- **Problem**: We attempted to "fix" the Developer Mode and blacklist issues by having `wrapper.ts` manually inject `developer_mode: true` into the `Preferences` JSON file, while simultaneously deleting the `Secure Preferences` file. However, modern Chrome has aggressive anti-tampering defenses. When it detects that `Preferences` was modified but `Secure Preferences` is missing or the hash doesn't match, Chrome **instantly resets the profile**, wiping out the Developer Mode setting and disabling all unpacked extensions. This is why the user turning on Developer Mode manually kept getting reverted.
- **Fix**: Removed all code in `wrapper.ts` that manually modified or deleted the `Preferences` and `Secure Preferences` files. `--load-extension` natively handles enabling the extension on a clean profile without requiring manual JSON file tampering.

## Current State: RESOLVED
The extension now loads reliably. The service worker connects, and the AI can successfully trigger the visual overlay and status bar.
