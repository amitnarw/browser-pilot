import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

export async function runTroubleshooter(): Promise<string[]> {
  const lines: string[] = ["\x1b[36mRunning Web MCP Troubleshooter...\x1b[0m", ""];
  
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

  // Step 2: Kill Stale Processes
  try {
    if (process.platform === "win32") {
      // Kill node wrapper
      try {
        execSync(`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { ($_.CommandLine -like "*web-mcp*" -or $_.CommandLine -like "*chrome-devtools*") -and $_.ProcessId -ne ${process.pid} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`, { shell: "powershell.exe", stdio: "ignore" });
      } catch {}
      // Kill chrome
      try {
        execSync(`Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*web-mcp*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`, { shell: "powershell.exe", stdio: "ignore" });
      } catch {}
    } else {
      try { execSync(`pkill -f "node.*web-mcp"`, { stdio: "ignore" }); } catch {}
      try { execSync(`pkill -f "node.*chrome-devtools"`, { stdio: "ignore" }); } catch {}
      try { execSync(`pkill -f "chrome.*\\.web-mcp"`, { stdio: "ignore" }); } catch {}
    }
    // Give OS time to release file locks
    await new Promise(r => setTimeout(r, 1500));
    lines.push("\x1b[32m[✓]\x1b[0m Killed stale Node and Chrome processes");
  } catch (e) {
    lines.push("\x1b[31m[x]\x1b[0m Error killing stale processes");
  }

  // Step 3: Delete cached profiles
  try {
    const profiles = ["chrome-profile", "chrome-profile-v2"];
    let deletedAny = false;
    for (const p of profiles) {
      const profilePath = path.join(CONFIG_DIR, p);
      if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
        deletedAny = true;
      }
    }
    if (deletedAny) {
      lines.push("\x1b[32m[✓]\x1b[0m Deleted cached Chrome profiles");
    } else {
      lines.push("\x1b[90m[-]\x1b[0m No cached Chrome profiles found");
    }
  } catch (e) {
    lines.push("\x1b[31m[x]\x1b[0m Failed to delete Chrome profiles (a process might still be locking them)");
  }

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

  // Step 5: Check Puppeteer/Chrome detection
  try {
    let chromeFound = false;
    
    // Check standard paths first (fast)
    const paths = process.platform === "win32" ? [
      path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe")
    ] : [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      path.join(os.homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
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
      lines.push("\x1b[32m[✓]\x1b[0m Chrome executable detected");
    } else {
      lines.push("\x1b[31m[x]\x1b[0m Chrome executable NOT found");
    }
  } catch (e) {
    lines.push("\x1b[31m[x]\x1b[0m Error detecting Chrome executable");
  }

  lines.push("");
  lines.push("\x1b[32mTroubleshooting complete.\x1b[0m Environment is fresh.");

  return lines;
}
