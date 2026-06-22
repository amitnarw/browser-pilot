import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");

async function findChromePath(): Promise<string> {
  try {
    const puppeteer = (await import("puppeteer")).default;
    // Attempt to get the executable path
    let pptrPath = await puppeteer.executablePath();
    if (fs.existsSync(pptrPath)) {
      return pptrPath;
    }
  } catch (e) {
    // Ignore error
  }

  // Fallback to system Chromium if puppeteer fails
  const paths = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error("Chromium not found. Please install puppeteer properly or install chromium manually.");
}

export async function launchBrowser(onProgress?: (lines: string[]) => void): Promise<string[]> {
  const lines: string[] = [];
  const notify = () => { if (onProgress) onProgress([...lines]); };

  lines.push("Launching dedicated Chromium browser with Web MCP extension...");
  lines.push("\x1b[90m(Using a managed Chromium instance because modern Google Chromium blocks automated extension loading)\x1b[0m");
  notify();

  let chromeExe;
  try {
    chromeExe = await findChromePath();
  } catch (err) {
    lines.push("\x1b[31mERROR: " + (err as Error).message + "\x1b[0m");
    notify();
    return lines;
  }

  const profileDir = path.join(CONFIG_DIR, "chromium-profile-v2");
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

    // Clear Chromium extension caches
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
    notify();
    if (!fs.existsSync(extensionDir)) return lines;
  }

  const args = [
    "--remote-debugging-port=9222",
    `--user-data-dir=${profileDir}`,
    `--load-extension=${extensionDir}`,
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--disable-translate",
    "--disable-fre",
    "https://example.com",
    "--disable-features=DisableLoadExtensionCommandLineSwitch,ExtensionDisableUnsupportedDeveloper"
  ];

  const cleanEnv: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    if (!key.toUpperCase().startsWith("ELECTRON_") && 
        !key.toUpperCase().startsWith("OPENCODE_") && 
        !key.toUpperCase().startsWith("VSCODE_")) {
      cleanEnv[key] = process.env[key] as string;
    }
  }

  // Kill existing isolated profile process before relaunch (non-blocking)
  try {
    if (process.platform === 'win32') {
      spawn('wmic', ['process', 'where', `name='chrome.exe' and commandline like '%chromium-profile-v2%'`, 'call', 'terminate'], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('pkill', ['-f', `user-data-dir=${profileDir}`], { detached: true, stdio: 'ignore' }).unref();
    }
    // Give it a moment to terminate before we relaunch
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    // Ignore error
  }

  const proc = spawn(chromeExe, args, {
    detached: true,
    stdio: "inherit",
    env: cleanEnv
  });

  proc.unref();
  lines.push("\x1b[32mChromium launched successfully! You can now close this terminal.\x1b[0m");
  notify();
  return lines;
}
