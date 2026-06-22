# Web MCP — Project Context & Handover Notes (Updated 2026-06-19)

## 1. The Core Problem (Root Cause — RESOLVED)

Chrome requires **Developer Mode ON** in the `Local State` file to allow unpacked extensions to inject content scripts.
- **Correct file:** `~/.web-mcp/chrome-profile-v2/Local State`
- **Correct JSON path:** `extensions.ui.developer_mode = true`

**Fix Applied:**
1. Code fix in `src/cli/browser.ts` and `src/mcp/wrapper.ts` — reads existing `Local State`, injects `developer_mode = true`, and writes atomically before launching Chrome.

---

## 2. The Second Problem (Root Cause — DISCOVERED!)

### Why was Chrome exiting after 5 seconds during `web-mcp browser`?
We noticed that Chrome would launch, bind to port 9222 briefly, and then immediately exit. It was doing a **single-instance handoff** and terminating because the `chrome-profile-v2` was already in use!

### Why was the profile in use?
Because **every single cleanup command in the entire codebase was silently failing!**

The codebase uses PowerShell commands like this to kill stale Chrome processes:
```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*.web-mcp*" } | Stop-Process -Force -ErrorAction SilentlyContinue
```

**The Bug:**
`Get-CimInstance` returns a WMI object. `Stop-Process` accepts pipeline input by property name. It finds the `Name` property (`"chrome.exe"`) and tries to run `Stop-Process -Name "chrome.exe"`. 
However, PowerShell's `Stop-Process` requires process names **without the `.exe` extension**. It throws a fatal error: `Cannot find a process with the name "chrome.exe"`. 
Because of `-ErrorAction SilentlyContinue`, this error was completely hidden!

**The Result:**
Old, disconnected Chrome processes were NEVER being killed. They lingered in the background permanently holding the `chrome-profile-v2` lock. When `web-mcp browser` or the MCP wrapper tried to launch a fresh Chrome, the new Chrome process detected the locked profile, passed its startup arguments to the zombie Chrome via IPC, and immediately exited.

---

## 3. The Fix We Need to Apply Everywhere

We must update all cleanup commands across the codebase.

**Incorrect:**
`... | Stop-Process -Force`

**Correct:**
`... | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`

### Files that need this fix:
1. `src/cli/stop.ts` (Lines ~40)
2. `src/cli/troubleshoot.ts` (Lines ~29, 33)
3. `src/mcp/wrapper.ts` (Lines ~397, 546)
4. `AGENTS.md` documentation

---

## 4. Current State & Next Steps
- The extension loads perfectly when Chrome is freshly launched.
- Developer mode injection works perfectly.
- The root cause for Chrome exiting has been definitively proven to be silent PowerShell pipeline failures leaving zombie Chrome processes.

**Next agent:**
Please apply the `ForEach-Object { Stop-Process -Id $_.ProcessId -Force }` fix to the files listed in Section 3, then run `npm run build && npm run bundle`, and finally test the full `web-mcp browser` lifecycle to verify everything is 100% stable.
