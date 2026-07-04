import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runTroubleshooter(onProgress?: (lines: string[]) => void): Promise<string[]> {
  const lines: string[] = ["\x1b[36mRunning Web MCP Troubleshooter...\x1b[0m", ""];
  
  const notify = () => { if (onProgress) onProgress([...lines]); };
  notify();

  const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");

  // Step 1: Delete config.json
  try {
    const configPath = path.join(CONFIG_DIR, "config.json");
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      lines.push("\x1b[32m[✓]\x1b[0m Deleted legacy config.json");
    } else {
      lines.push("\x1b[90m[-]\x1b[0m No legacy config.json found");
    }
  } catch (e) {
    lines.push("\x1b[31m[x]\x1b[0m Failed to delete config.json: " + String(e));
  }
  notify();

  // Step 2: Kill Stale Processes
  try {
    if (process.platform === "win32") {
      try { await execAsync(`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { ($_.CommandLine -like '*dist\\server\\server.min.js*' -or $_.CommandLine -like '*dist\\mcp\\wrapper.min.js*' -or $_.CommandLine -like '*chrome-devtools*') -and $_.ProcessId -ne ${process.pid} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`, { shell: "powershell.exe" }); } catch {}
      try { await execAsync(`Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*chromium-profile-v2*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`, { shell: "powershell.exe" }); } catch {}
    } else {
      try { await execAsync(`pkill -f "dist/server/server.min.js" 2>/dev/null; pkill -f "dist/mcp/wrapper.min.js" 2>/dev/null`); } catch {}
      try { await execAsync(`pkill -f "node.*chrome-devtools"`); } catch {}
      try { await execAsync(`pkill -f "chrome.*chromium-profile-v2"`); } catch {}
    }
    // Give OS time to release file locks
    await new Promise(r => setTimeout(r, 1500));
    lines.push("\x1b[32m[✓]\x1b[0m Killed stale Node and Chromium processes");
  } catch (e) {
    lines.push("\x1b[31m[x]\x1b[0m Error killing stale processes");
  }
  notify();

  // Step 3: Delete cached profiles
  try {
    // Legacy cleanup: old "chrome-profile*" names from v0.1.3 and earlier, canonical is "chromium-profile-v2"
    const profiles = ["chrome-profile", "chrome-profile-v2", "chromium-profile-v2"];
    let deletedAny = false;
    for (const p of profiles) {
      const profilePath = path.join(CONFIG_DIR, p);
      if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
        deletedAny = true;
      }
    }
    if (deletedAny) {
      lines.push("\x1b[32m[✓]\x1b[0m Deleted cached Chromium profiles");
    } else {
      lines.push("\x1b[90m[-]\x1b[0m No cached Chromium profiles found");
    }
  } catch (e) {
    lines.push("\x1b[31m[x]\x1b[0m Failed to delete Chromium profiles (a process might still be locking them)");
  }
  notify();

  // Step 4: Delete cached extension
  try {
    const extPath = path.join(CONFIG_DIR, "extension");
    if (fs.existsSync(extPath)) {
      fs.rmSync(extPath, { recursive: true, force: true });
      lines.push("\x1b[32m[✓]\x1b[0m Deleted cached extension directory");
    } else {
      lines.push("\x1b[90m[-]\x1b[0m No cached extension directory found");
    }
  } catch (e) {
    lines.push("\x1b[31m[x]\x1b[0m Failed to delete cached extension directory");
  }
  notify();

  // Step 5: Check Puppeteer/Chromium detection
  try {
    let chromeFound = false;
    
    // Check standard paths first (fast)
    const paths = process.platform === "win32" ? [
      path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chromium", "Application", "chrome.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chromium", "Application", "chrome.exe"),
      path.join(os.homedir(), "AppData", "Local", "Google", "Chromium", "Application", "chrome.exe")
    ] : [
      "/Applications/Google Chromium.app/Contents/MacOS/Google Chromium",
      path.join(os.homedir(), "Applications", "Google Chromium.app", "Contents", "MacOS", "Google Chromium"),
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser"
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) chromeFound = true;
    }

    // Fallback to puppeteer (slow)
    if (!chromeFound) {
      try {
        const puppeteer = require("puppeteer");
        const pptrPath = await puppeteer.executablePath();
        if (fs.existsSync(pptrPath)) chromeFound = true;
      } catch {
        // Ignore error
      }
    }
    
    if (chromeFound) {
      lines.push("\x1b[32m[✓]\x1b[0m Chromium executable detected");
    } else {
      lines.push("\x1b[31m[x]\x1b[0m Chromium executable NOT found");
    }
  } catch (e) {
    lines.push("\x1b[31m[x]\x1b[0m Error detecting Chromium executable");
  }
  notify();

  lines.push("");
  lines.push("\x1b[32mTroubleshooting complete.\x1b[0m Environment is fresh.");
  notify();

  return lines;
}
