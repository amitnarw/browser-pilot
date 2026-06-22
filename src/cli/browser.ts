import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, execSync } from "child_process";

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");

async function findChromePath(): Promise<string> {
  const paths = [
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    path.join(os.homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }

  // Fallback to puppeteer (slow)
  try {
    const puppeteer = (await import("puppeteer")).default;
    const pptrPath = await puppeteer.executablePath();
    if (fs.existsSync(pptrPath)) {
      return pptrPath;
    }
  } catch (e) {
    // Ignore error
  }

  throw new Error("Chrome not found.");
}

export async function launchBrowser(): Promise<string[]> {
  const lines: string[] = [];
  lines.push("Launching isolated Chrome with Web MCP extension...");
  
  let chromeExe;
  try {
    chromeExe = await findChromePath();
  } catch (err) {
    lines.push("\x1b[31mERROR: " + (err as Error).message + "\x1b[0m");
    return lines;
  }

  const profileDir = path.join(CONFIG_DIR, "chrome-profile-v2");
  const extensionDir = path.join(CONFIG_DIR, "extension");

  try {
    const { fileURLToPath } = await import("url");
    const __filename = fileURLToPath(import.meta.url);
    const sourceExtDir = path.join(path.dirname(__filename), "..", "..", "extension");
    
    if (fs.existsSync(sourceExtDir)) {
      if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.cpSync(sourceExtDir, extensionDir, { recursive: true, force: true });
      fs.writeFileSync(path.join(extensionDir, "env.js"), `globalThis.WEB_MCP_PORT = 3026;\n`);
    } else if (!fs.existsSync(extensionDir)) {
      throw new Error("Source extension directory not found.");
    }

    // Clear Chrome extension caches
    const defaultExt = path.join(profileDir, "Default", "Extensions");
    if (fs.existsSync(defaultExt)) fs.rmSync(defaultExt, { recursive: true, force: true });
    const crxCache = path.join(profileDir, "extensions_crx_cache");
    if (fs.existsSync(crxCache)) fs.rmSync(crxCache, { recursive: true, force: true });

    // Seed Developer Mode to allow unpacked extensions
    try {
      fs.mkdirSync(path.join(profileDir, "Default"), { recursive: true });
      const localStatePath = path.join(profileDir, "Local State");
      let localState: any = {};
      if (fs.existsSync(localStatePath)) {
        try { localState = JSON.parse(fs.readFileSync(localStatePath, "utf8")); } catch { /* ignore */ }
      }
      if (!localState.extensions) localState.extensions = {};
      if (!localState.extensions.ui) localState.extensions.ui = {};
      localState.extensions.ui.developer_mode = true;
      const tmpPath = localStatePath + ".tmp." + Date.now();
      fs.writeFileSync(tmpPath, JSON.stringify(localState, null, 2));
      fs.renameSync(tmpPath, localStatePath);
    } catch (e) {
      // ignore
    }

  } catch (e) {
    lines.push("\x1b[31mERROR: Failed to copy extension: " + (e as Error).message + "\x1b[0m");
    if (!fs.existsSync(extensionDir)) return lines;
  }

  const args = [
    "--remote-debugging-port=9222",
    `--user-data-dir=${profileDir}`,
    `--load-extension=${extensionDir}`,
    `--disable-extensions-except=${extensionDir}`,
    "--enable-automation",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--disable-translate",
    "--disable-fre",
    "https://example.com"
  ];

  const cleanEnv: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    if (!key.toUpperCase().startsWith("ELECTRON_") && 
        !key.toUpperCase().startsWith("OPENCODE_") && 
        !key.toUpperCase().startsWith("VSCODE_")) {
      cleanEnv[key] = process.env[key] as string;
    }
  }

  console.log("Chrome args:", args);

  // Kill existing isolated profile process before relaunch
  try {
    if (process.platform === 'win32') {
      execSync(`wmic process where "name='chrome.exe' and commandline like '%chrome-profile-v2%'" call terminate`, { stdio: 'ignore' });
    } else {
      execSync(`pkill -f "user-data-dir=${profileDir}"`, { stdio: 'ignore' });
    }
  } catch (e) {
    // Ignore error
  }

  const proc = spawn(chromeExe, args, {
    detached: true,
    stdio: "inherit",
    env: cleanEnv
  });

  proc.unref();
  lines.push("\x1b[32mChrome launched successfully! You can now close this terminal.\x1b[0m");
  return lines;
}
