import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { spawn, ChildProcess, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ───────────────────────────────────────────────────────

interface ServerConfig {
  port: number;
  script: string;
  startupTimeout: number;
}

interface ChromeConfig {
  port: number;
  executable: string;
  profileDir: string;
  startupTimeout: number;
}

interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
}

interface Config {
  server: ServerConfig;
  chrome: ChromeConfig;
  extension: { dir: string };
  logging: LoggingConfig;
}

interface ProcessState {
  server: {
    running: boolean;
    healthy: boolean;
    weStarted: boolean;
    process: ChildProcess | null;
    pid: number | null;
  };
  chrome: {
    running: boolean;
    healthy: boolean;
    weStarted: boolean;
    pid: number | null;
  };
  session: {
    status: "idle" | "launching" | "ready" | "running" | "waiting" | "closing";
    taskName: string | null;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────

const CHROME_DEVTOOLS_MCP_PACKAGE = "chrome-devtools-mcp";
const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const PID_FILE = path.join(CONFIG_DIR, "server.pid");

// ─── State ───────────────────────────────────────────────────────────────

let config: Config;
let state: ProcessState = {
  server: { running: false, healthy: false, weStarted: false, process: null, pid: null },
  chrome: { running: false, healthy: false, weStarted: false, pid: null },
  session: { status: "idle", taskName: null },
};

let chromeDevtoolsClient: Client | null = null;
let sidebarActive = false;
let sidebarTaskName: string | null = null;
let cleanupDone = false;
let isInitializing = false;
let lastToolCallTime: number = 0;
const BROWSER_IDLE_TIMEOUT_MS = 90_000; // 90 seconds

// ─── Logging ─────────────────────────────────────────────────────────────

enum LogLevel { DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3 }

const LOG_LEVELS: Record<string, LogLevel> = { debug: LogLevel.DEBUG, info: LogLevel.INFO, warn: LogLevel.WARN, error: LogLevel.ERROR };

function log(msg: string, level: LogLevel = LogLevel.INFO): void {
  const configuredLevel = LOG_LEVELS[config?.logging?.level || "info"] || LogLevel.INFO;
  if (level < configuredLevel) return;

  const prefix = "[web-mcp]";
  const levelStr = LogLevel[level].padEnd(5);
  process.stderr.write(`${prefix} [${levelStr}] ${msg}\n`);
}

// ─── Config ──────────────────────────────────────────────────────────────

function getDefaultConfig(): Config {
  const packageRoot = path.join(__dirname, "..", "..");
  // Use .min.js (bundled) if available, otherwise fall back to .js (development)
  const serverScriptMin = path.join(packageRoot, "dist", "server", "server.min.js");
  const serverScriptDev = path.join(packageRoot, "dist", "server", "server.js");
  const serverScript = fs.existsSync(serverScriptMin) ? serverScriptMin : serverScriptDev;

  let extensionDir = path.join(packageRoot, "extension");
  // During local dev, if the build hasn't run yet, fall back to the source directory
  if (!fs.existsSync(extensionDir) || !fs.existsSync(path.join(extensionDir, "manifest.json"))) {
    const srcExtensionDir = path.join(packageRoot, "src", "extension");
    if (fs.existsSync(path.join(srcExtensionDir, "manifest.json"))) {
      extensionDir = srcExtensionDir;
    }
  }

  return {
    server: {
      port: 3026,
      script: serverScript,
      startupTimeout: 15000,
    },
    chrome: {
      port: 9222,
      executable: "auto-detect",
      profileDir: path.join(CONFIG_DIR, "chromium-profile-v2"),
      startupTimeout: 20000,
    },
    extension: {
      dir: extensionDir,
    },
    logging: {
      level: "info",
    },
  };
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key] && typeof target[key] === "object") {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

function loadConfig(): Config {
  const defaults = getDefaultConfig();

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      const userConfig = JSON.parse(raw);
      const merged = deepMerge(defaults as unknown as Record<string, unknown>, userConfig) as unknown as Config;
      
      // Critical Fix: Always use the dynamic paths for the current package location.
      // If we don't do this, updating the package might continue using old files
      // because absolute paths were saved in the user's config.json on the first run.
      merged.server.script = defaults.server.script;
      merged.extension.dir = defaults.extension.dir;

      log("Config loaded from " + CONFIG_FILE);
      return merged;
    } catch (err) {
      log("WARNING: Failed to parse config file, using defaults: " + (err as Error).message, LogLevel.WARN);
      return defaults;
    }
  }

  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    
    // Create a clean config for saving, excluding absolute paths that shouldn't be hardcoded
    const configToSave = {
      server: { port: defaults.server.port, startupTimeout: defaults.server.startupTimeout },
      chrome: { port: defaults.chrome.port, executable: defaults.chrome.executable, startupTimeout: defaults.chrome.startupTimeout },
      logging: defaults.logging
    };
    
    const tempConfig = CONFIG_FILE + ".tmp." + Date.now();
    fs.writeFileSync(tempConfig, JSON.stringify(configToSave, null, 2));
    fs.renameSync(tempConfig, CONFIG_FILE);
    log("Created default config at " + CONFIG_FILE);
  } catch (err) {
    log("WARNING: Could not create config file: " + (err as Error).message, LogLevel.WARN);
  }

  return defaults;
}

// ─── Utilities ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs: number = 3000, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

// ─── Health Checks ───────────────────────────────────────────────────────

async function checkServerHealth(): Promise<{ healthy: boolean; data?: Record<string, unknown> }> {
  try {
    const resp = await fetchWithTimeout(`http://localhost:${config.server.port}/status`, 3000);
    const data = await resp.json() as Record<string, unknown>;
    if (data && typeof data === "object" && "uptime" in data) {
      return { healthy: true, data };
    }
  } catch {}
  return { healthy: false };
}

async function checkChromeHealth(): Promise<{ running: boolean; healthy: boolean }> {
  try {
    const resp = await fetchWithTimeout(`http://127.0.0.1:${config.chrome.port}/json/version`, 3000);
    const data = await resp.json() as Record<string, unknown>;
    return { running: true, healthy: !!data.webSocketDebuggerUrl };
  } catch {
    return { running: false, healthy: false };
  }
}

async function waitForHealthy(checkFn: () => Promise<{ healthy: boolean }>, maxWaitMs: number, label: string): Promise<boolean> {
  const start = Date.now();
  const checkInterval = 200;

  while (Date.now() - start < maxWaitMs) {
    const result = await checkFn();
    if (result.healthy) {
      log(`  → ${label} healthy ✓`);
      return true;
    }
    await sleep(checkInterval);
  }

  log(`  → ${label} not healthy after ${maxWaitMs / 1000}s`, LogLevel.ERROR);
  return false;
}

// ─── Chromium Detection ────────────────────────────────────────────────────

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

// ─── Server Management ───────────────────────────────────────────────────

let heartbeatTimer: NodeJS.Timeout | null = null;

async function startServer(): Promise<boolean> {
  log("Starting coordination server...");

  const serverScript = config.server.script;
  if (!fs.existsSync(serverScript)) {
    log("ERROR: Server script not found: " + serverScript, LogLevel.ERROR);
    return false;
  }

  // Kill any stale server from a previous wrapper instance
  await killStaleServer();

  const proc = spawn("node", [serverScript], {
    cwd: path.dirname(serverScript),
    detached: true,
    stdio: "ignore",
  });

  proc.unref();

  proc.on("exit", (code) => {
    if (code !== 0 && state.server.weStarted) {
      log(`Server crashed (exit code: ${code})`, LogLevel.WARN);
      state.server.running = false;
      state.server.healthy = false;
      state.server.process = null;
      state.server.pid = null;
    }
  });

  state.server.weStarted = true;
  state.server.process = proc;
  state.server.pid = proc.pid || null;

  log("  → Server started (PID: " + proc.pid + ")");

  const healthy = await waitForHealthy(checkServerHealth, config.server.startupTimeout, "Server");
  if (healthy) {
    state.server.running = true;
    state.server.healthy = true;
    startHeartbeat();
    return true;
  }

  return false;
}

async function killStaleServer(): Promise<void> {
  // First, check if the server is actually alive and healthy
  try {
    const resp = await fetchWithTimeout(`http://localhost:${config.server.port}/ping`, 1000);
    const data = await resp.json() as { status?: string };
    if (data && data.status === "ok") {
      log("  → Existing server is healthy, no need to kill.");
      return;
    }
  } catch {
    // Server is dead or not responding, proceed to kill
  }

  // Use OS commands to aggressively find and kill any squatter on the port, even if PID_FILE is missing
  log("  → Aggressively clearing port " + config.server.port);
  try {
    if (process.platform === "win32") {
      execSync(`powershell -Command "$pidToKill = Get-NetTCPConnection -LocalPort ${config.server.port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1; if ($pidToKill) { Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore" });
    } else {
      execSync(`lsof -t -i:${config.server.port} | xargs -r kill -9`, { stdio: "ignore" });
    }
  } catch {
    // Ignore OS kill errors
  }

  // Also clean up PID file
  try { fs.unlinkSync(PID_FILE); } catch {}
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    if (!state.server.weStarted) return;
    const health = await checkServerHealth();
    if (!health.healthy && state.server.running) {
      log("Heartbeat failed — server crashed", LogLevel.WARN);
      state.server.running = false;
      state.server.healthy = false;
      state.server.process = null;
      state.server.pid = null;
      stopHeartbeat();
    }
  }, 30_000); // Every 30 seconds
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ─── Chromium Management ───────────────────────────────────────────────────

async function launchChrome(): Promise<boolean> {
  log("Launching Chromium with extension auto-load...");

  // Force kill any stale zombie Chromium processes running this profile
  try {
    log("  -> Cleaning up stale Web MCP Chromium processes...");
    if (process.platform === "win32") {
      // Kill web-mcp Chromium ONLY
      execSync(
        `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ` +
        `Where-Object { $_.CommandLine -like "*.web-mcp*" } | ` +
        `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
        { shell: "powershell.exe", stdio: "ignore" }
      );
    } else {
      execSync(`pkill -f "chrome.*\\.web-mcp/chromium-profile-v2"`, { stdio: "ignore" });
    }
    // Give the OS time to fully terminate processes and release file locks
    await sleep(1500);
    log("  -> Chromium processes cleared");
  } catch {
    // Ignore errors (usually means no processes found, which is fine)
  }

  let chromeExe: string;
  try {
    chromeExe = config.chrome.executable === "auto-detect" ? await findChromePath() : config.chrome.executable;
  } catch (err) {
    log("ERROR: " + (err as Error).message, LogLevel.ERROR);
    return false;
  }

  const extensionDir = config.extension.dir;
  if (!fs.existsSync(extensionDir)) {
    log("ERROR: Extension directory not found: " + extensionDir, LogLevel.ERROR);
    return false;
  }

  const profileDir = config.chrome.profileDir;

  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }



  // Create a safe, user-owned copy of the extension directory
  // This prevents EACCES permission denied errors if the package was installed globally via root (sudo npm install -g)
  const userExtensionDir = path.join(CONFIG_DIR, "extension");
  let finalExtensionDir = userExtensionDir;
  try {
    if (!fs.existsSync(path.join(userExtensionDir, "manifest.json"))) {
      fs.cpSync(extensionDir, userExtensionDir, { recursive: true, force: true });
    }
    
    // Inject environment variables atomically
    const envFile = path.join(userExtensionDir, "env.js");
    const tempEnv = envFile + ".tmp." + Date.now();
    fs.writeFileSync(tempEnv, `globalThis.WEB_MCP_PORT = ${config.server.port};\n`);
    fs.renameSync(tempEnv, envFile);
  } catch (err) {
    log("WARNING: Failed to copy extension directory to " + userExtensionDir + ": " + (err as Error).message, LogLevel.WARN);
    log("Falling back to original extension directory: " + extensionDir, LogLevel.WARN);
    finalExtensionDir = extensionDir;
  }

  // ── Seed Chromium profile with Developer Mode enabled ───────────────────
  // Chromium requires Developer Mode ON in Local State to allow unpacked
  // extensions (--load-extension) to inject content scripts and display UI.
  // The flag lives in Local State (profile root), NOT Default/Preferences.
  try {
    fs.mkdirSync(path.join(profileDir, "Default"), { recursive: true });
    const localStatePath = path.join(profileDir, "Local State");
    let localState: Record<string, unknown> = {};
    if (fs.existsSync(localStatePath)) {
      try { localState = JSON.parse(fs.readFileSync(localStatePath, "utf8")); } catch { /* ignore corrupt/empty file */ }
    }
    if (!localState.extensions || typeof localState.extensions !== "object") {
      localState.extensions = {};
    }
    const ext = localState.extensions as Record<string, unknown>;
    if (!ext.ui || typeof ext.ui !== "object") {
      ext.ui = {};
    }
    (ext.ui as Record<string, unknown>).developer_mode = true;
    // Write atomically to prevent corruption
    const tmpPath = localStatePath + ".tmp." + Date.now();
    fs.writeFileSync(tmpPath, JSON.stringify(localState, null, 2));
    fs.renameSync(tmpPath, localStatePath);
    log("  → Developer Mode seeded in Local State ✓");
  } catch (err) {
    log("  → WARNING: Failed to seed Developer Mode in Local State: " + (err as Error).message, LogLevel.WARN);
  }

  const args = [
    `--remote-debugging-port=${config.chrome.port}`,
    `--user-data-dir=${profileDir}`,
    `--load-extension=${finalExtensionDir}`,
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--disable-translate",
    "--disable-default-apps",
    "--disable-fre",
    "--disable-session-crashed-bubble",
  ];

  fs.writeFileSync(path.join(CONFIG_DIR, "chrome-args-debug.log"), args.join("\n"));

  // Capture Chromium's stderr to a log file — lets us see exactly why Chromium rejects the extension
  const chromeStderrLog = path.join(CONFIG_DIR, "chrome-stderr.log");
  let stderrFd: number | null = null;
  try {
    stderrFd = fs.openSync(chromeStderrLog, "w");
  } catch { /* ignore */ }

  fs.writeFileSync(path.join(CONFIG_DIR, "debug-extension-dir.txt"), "Extension Dir: " + finalExtensionDir + "\nArgs: " + args.join(" "));
  fs.writeFileSync(path.join(CONFIG_DIR, "debug-env-dump.json"), JSON.stringify(process.env, null, 2));

  // Clean environment variables to prevent OpenCode's Electron variables from breaking Chromium
  const cleanEnv: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    if (!key.toUpperCase().startsWith("ELECTRON_") && 
        !key.toUpperCase().startsWith("OPENCODE_") && 
        !key.toUpperCase().startsWith("VSCODE_")) {
      cleanEnv[key] = process.env[key] as string;
    }
  }

  const proc = spawn(chromeExe, args, {
    detached: true,
    stdio: ["ignore", "ignore", stderrFd ?? "ignore"],
    env: cleanEnv,
  });

  if (stderrFd !== null) {
    try { fs.closeSync(stderrFd); } catch { /* ignore */ }
  }

  // Detect single-instance handoff: Chromium immediately exits (pid dead within 500ms)
  await sleep(500);
  const procStillAlive = (() => {
    try { process.kill(proc.pid!, 0); return true; } catch { return false; }
  })();
  if (!procStillAlive) {
    log("  → WARNING: Chromium process (PID " + proc.pid + ") exited immediately!", LogLevel.WARN);
    log("  → This usually means another Chromium instance was running and stole the launch.", LogLevel.WARN);
    log("  → Chromium stderr log: " + chromeStderrLog, LogLevel.WARN);
    // Try once more: the kill above might not have had time to fully close all Chromium windows
    log("  → Retrying after additional cleanup delay...");
    try {
      if (process.platform === "win32") {
        const profileDirEscaped = config.chrome.profileDir.replace(/\\/g, "\\\\");
        execSync(
          `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*.web-mcp*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
          { shell: "powershell.exe", stdio: "ignore" }
        );
      }
    } catch { /* ignore */ }
    await sleep(2000);
    // Reopen stderr log for retry
    let retryStderrFd: number | null = null;
    try { retryStderrFd = fs.openSync(chromeStderrLog, "w"); } catch { /* ignore */ }
    const retryProc = spawn(chromeExe, args, {
      detached: true,
      stdio: ["ignore", "ignore", retryStderrFd ?? "ignore"],
    });
    if (retryStderrFd !== null) { try { fs.closeSync(retryStderrFd); } catch { /* ignore */ } }
    retryProc.unref();
    state.chrome.pid = retryProc.pid || null;
    log("  → Retry Chromium launched (PID: " + retryProc.pid + ")");
  }

  // If the first proc died (handoff), state.chrome.pid was already updated in the retry block above.
  // Otherwise, set it from the original proc.
  if (procStillAlive) {
    proc.unref();
    state.chrome.weStarted = true;
    state.chrome.pid = proc.pid || null;
  } else {
    state.chrome.weStarted = true;
    // pid was already set in retry block
  }

  log("  → Chromium launched (PID: " + (state.chrome.pid ?? "unknown") + ")");
  log("  → Extension loaded from: " + extensionDir);
  log("  → Waiting for Chromium to be ready...");

  const healthy = await waitForHealthy(checkChromeHealth, config.chrome.startupTimeout, "Chromium");
  if (healthy) {
    state.chrome.running = true;
    state.chrome.healthy = true;

    // Verify extension service worker is loaded (prevents hijacking an unprotected Chromium on 9222)
    let extensionFound = false;
    for (let i = 0; i < 5; i++) {
      try {
        const resp = await fetchWithTimeout(`http://127.0.0.1:${config.chrome.port}/json`, 2000);
        const targets = await resp.json() as Array<Record<string, unknown>>;
        if (targets.find((t) => t.type === "service_worker")) {
          extensionFound = true;
          break;
        }
      } catch {
        // Ignore fetch errors during retry
      }
      await sleep(1000);
    }

    if (extensionFound) {
      log("  → Extension service worker detected ✓");
      return true;
    } else {
      log("  → ERROR: Chromium is running on port " + config.chrome.port + ", but the Web MCP extension is NOT loaded!", LogLevel.ERROR);
      log("  → This usually means you manually opened Chromium with --remote-debugging-port=" + config.chrome.port, LogLevel.ERROR);
      state.chrome.running = false;
      state.chrome.healthy = false;
      // Intentionally crash the launch sequence
      // We do NOT want to control an unprotected browser
      throw new Error("Chromium is running but the Web MCP extension failed to load. Please close any manual Chromium instances using port " + config.chrome.port + ".");
    }
  }

  return false;
}

// ─── Sidebar Management ─────────────────────────────────────────────────

async function httpRequest(method: string, urlPath: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = `http://localhost:${config.server.port}${urlPath}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);
  try {
    const resp = await fetchWithTimeout(url, 5000, options);
    return (await resp.json()) as Record<string, unknown>;
  } catch (err) {
    return { success: false, error: "Server not reachable: " + (err as Error).message };
  }
}

async function ensureSidebarActive(taskName: string): Promise<void> {
  sidebarTaskName = taskName;
  if (sidebarActive) {
    log("[ensureSidebarActive] Already active, skipping");
    return;
  }
  log("[ensureSidebarActive] Calling /sidebar/start with taskName: " + taskName);
  const result = await httpRequest("POST", "/sidebar/start", { taskName });
  log("[ensureSidebarActive] Response: " + JSON.stringify(result));
  if (result.success) {
    sidebarActive = true;
    log("[ensureSidebarActive] sidebarActive set to true");
  } else {
    log("[ensureSidebarActive] FAILED — sidebarActive remains false", LogLevel.ERROR);
  }
}

async function endSidebar(): Promise<void> {
  if (!sidebarActive) return;
  await httpRequest("POST", "/sidebar/end");
  sidebarActive = false;
  sidebarTaskName = null;
}

async function addSidebarAction(text: string, type?: string): Promise<void> {
  if (!sidebarActive) return;
  await httpRequest("POST", "/sidebar/action", { text, type });
}

// ─── chrome-devtools-mcp Connection ──────────────────────────────────────

async function connectToChromeDevtoolsMcp(): Promise<boolean> {
  if (chromeDevtoolsClient) {
    log("chrome-devtools-mcp already connected");
    return true;
  }

  const maxRetries = 5;
  const retryDelayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`Connecting to chrome-devtools-mcp (attempt ${attempt}/${maxRetries})...`);

    const transport = new StdioClientTransport({
      command: "npx",
      args: [CHROME_DEVTOOLS_MCP_PACKAGE, `--browserUrl=http://127.0.0.1:${config.chrome.port}`],
    });

    chromeDevtoolsClient = new Client(
      { name: "web-mcp-wrapper", version: "1.0.0" },
      { capabilities: {} }
    );

    try {
      await chromeDevtoolsClient.connect(transport);
      log("  → Connected to chrome-devtools-mcp ✓");
      return true;
    } catch (err) {
      log("  → Attempt " + attempt + " failed: " + (err as Error).message, attempt < maxRetries ? LogLevel.WARN : LogLevel.ERROR);
      chromeDevtoolsClient = null;
      if (attempt < maxRetries) {
        await sleep(retryDelayMs);
      }
    }
  }

  return false;
}

// ─── ensureBrowserReady ──────────────────────────────────────────────────

async function ensureBrowserReady(): Promise<{ ok: boolean; error?: string }> {
  log("[ensureBrowserReady] Called. isInitializing=" + isInitializing + " session.status=" + state.session.status + " chromeDevtoolsClient=" + !!chromeDevtoolsClient + " sidebarActive=" + sidebarActive);

  // Prevent concurrent initialization
  if (isInitializing) {
    log("[ensureBrowserReady] Already initializing, waiting...");
    // Wait for initialization to complete
    while (isInitializing) {
      await sleep(500);
    }
    if (state.session.status === "ready" || state.session.status === "running") {
      log("[ensureBrowserReady] Initialization completed successfully");
      return { ok: true };
    }
    log("[ensureBrowserReady] Initialization failed");
    return { ok: false, error: "Initialization failed" };
  }

  // Already ready
  if ((state.session.status === "ready" || state.session.status === "running") && chromeDevtoolsClient && sidebarActive) {
    log("[ensureBrowserReady] Already ready, returning early");
    return { ok: true };
  }

  log("[ensureBrowserReady] Starting initialization...");
  isInitializing = true;

  try {
    // Start server if needed
    log("[ensureBrowserReady] Checking server health...");
    const serverHealth = await checkServerHealth();
    log("[ensureBrowserReady] Server healthy: " + serverHealth.healthy);
    if (!serverHealth.healthy) {
      log("[ensureBrowserReady] Server not running, auto-starting...");
      if (!(await startServer())) {
        state.session.status = "idle";
        log("[ensureBrowserReady] Failed to start server", LogLevel.ERROR);
        return { ok: false, error: "Failed to start coordination server" };
      }
    } else {
      state.server.running = true;
      state.server.healthy = true;
      
      // Check if user recently halted the session
      if (serverHealth.data && typeof serverHealth.data.lastUserHaltTime === "number") {
        const timeSinceHalt = Date.now() - serverHealth.data.lastUserHaltTime;
        if (timeSinceHalt < 10000) {
          log("[ensureBrowserReady] User halted the session recently. Aborting.");
          state.session.status = "idle";
          return { ok: false, error: "The user manually halted the session. You MUST stop execution immediately and await further instructions." };
        }
      }
    }

    // Start Chromium if needed
    log("[ensureBrowserReady] Checking Chromium health...");
    const chromeHealth = await checkChromeHealth();
    log("[ensureBrowserReady] Chromium healthy: " + chromeHealth.healthy);
    if (!chromeHealth.healthy) {
      log("[ensureBrowserReady] Chromium not running, auto-launching...");
      // Close stale chrome-devtools-mcp client if Chromium was down
      if (chromeDevtoolsClient) {
        try { await chromeDevtoolsClient.close(); } catch {}
        chromeDevtoolsClient = null;
      }
      if (!(await launchChrome())) {
        state.session.status = "idle";
        log("[ensureBrowserReady] Failed to launch Chromium", LogLevel.ERROR);
        return { ok: false, error: "Failed to launch Chromium" };
      }
    } else {
      state.chrome.running = true;
      state.chrome.healthy = true;
    }

    // Start session — do this early so the sidebar shows immediately
    log("[ensureBrowserReady] session.status=" + state.session.status + " — calling /session/start if idle...");
    if (state.session.status === "idle") {
      const sessionResult = await httpRequest("POST", "/session/start", { taskName: "AI Browser Task" });
      log("[ensureBrowserReady] /session/start response: " + JSON.stringify(sessionResult));
    }

    // Activate sidebar — must be AFTER server is running (was failing before)
    log("[ensureBrowserReady] sidebarActive=" + sidebarActive + " — calling ensureSidebarActive if false...");
    if (!sidebarActive) {
      await ensureSidebarActive("AI Browser Task");
    }
    log("[ensureBrowserReady] After ensureSidebarActive: sidebarActive=" + sidebarActive);

    // Connect to chrome-devtools-mcp if needed (non-fatal — sidebar still works without it)
    if (!chromeDevtoolsClient) {
      log("[ensureBrowserReady] Connecting to chrome-devtools-mcp...");
      const connected = await connectToChromeDevtoolsMcp();
      log("[ensureBrowserReady] chrome-devtools-mcp connected: " + connected);
      if (!connected) {
        log("[ensureBrowserReady] chrome-devtools-mcp connection failed — browser actions will be unavailable until reconnected", LogLevel.WARN);
        // Don't return error — session is started, sidebar will show
      }
    }

    state.session.status = "ready";
    log("[ensureBrowserReady] Browser ready ✓");
    return { ok: true };
  } finally {
    isInitializing = false;
  }
}

// ─── chrome-devtools-mcp Tool Caller ─────────────────────────────────────

async function callChromeDevtoolsTool(
  toolName: string,
  args: Record<string, unknown>,
  sidebarText: string | null,
  sidebarType: string
): Promise<{ content: { type: "text"; text: string }[] }> {
  // Check if the user recently halted the session BEFORE doing anything else
  const health = await checkServerHealth();
  if (health.healthy && health.data && typeof health.data.lastUserHaltTime === "number") {
    const timeSinceHalt = Date.now() - health.data.lastUserHaltTime;
    if (timeSinceHalt < 10000) {
      log("[callChromeDevtoolsTool] User halted the session recently. Aborting.");
      state.session.status = "idle";
      return {
        content: [{ type: "text" as const, text: "ERROR: The user manually halted the session. You MUST stop execution immediately and await further instructions." }],
      };
    }
  }

  // Ensure browser is ready
  const ready = await ensureBrowserReady();
  if (!ready.ok) {
    return {
      content: [{ type: "text" as const, text: "ERROR: " + ready.error + "\n\nCRITICAL AI INSTRUCTION: DO NOT attempt to fix this by killing the Chromium process manually (e.g. Stop-Process or taskkill), and DO NOT try to rebuild the extension using npm commands. Simply report this exact error to the user and await instructions." }],
    };
  }

  if (!chromeDevtoolsClient) {
    return {
      content: [{ type: "text" as const, text: "ERROR: chrome-devtools-mcp not connected" + "\n\nCRITICAL AI INSTRUCTION: DO NOT attempt to fix this by killing the Chromium process manually (e.g. Stop-Process or taskkill), and DO NOT try to rebuild the extension using npm commands. Simply report this exact error to the user and await instructions." }],
    };
  }

  try {
    // Update session state and track activity
    state.session.status = "running";
    lastToolCallTime = Date.now();
    await httpRequest("POST", "/session/lock", { owner: "agent", action: toolName });

    // Log to sidebar
    if (sidebarText !== null) {
      await addSidebarAction(sidebarText, sidebarType);
    }

    // Delay to let the visual fake cursor reach the element before actual execution!
    // This perfectly synchronizes the UI with the headless browser action.
    const isMouse = ["click", "hover", "drag"].includes(sidebarType);
    const isKeyboard = ["type", "fill", "keypress"].includes(sidebarType);
    let flagSet = false;
    
    try {
      if (isMouse || isKeyboard) {
        const flagValue = isMouse ? 'mouse' : 'keyboard';
        // Tell the JS capture listeners and CSS overlay to let the next CDP event through!
        // We use requestAnimationFrame to guarantee the browser's rendering pipeline has fully applied the CSS pointer-events rules before we dispatch the click.
        await chromeDevtoolsClient.callTool({
          name: "evaluate_script",
          arguments: { function: `() => { 
            return new Promise(resolve => {
              document.documentElement.setAttribute('data-bp-ai-acting', '${flagValue}'); 
              document.documentElement.offsetHeight; // force sync layout
              let done = false;
              const finish = () => { if(!done) { done=true; resolve(); } };
              requestAnimationFrame(() => requestAnimationFrame(finish));
              setTimeout(finish, 100); // safety fallback
            });
          }` }
        }).catch((err) => { console.error("EVALUATE SCRIPT FAILED:", err); });
        flagSet = true;
        
        if (isMouse) {
          await sleep(50); // micro-delay to ensure CDP event ordering
        }
      }

      // Call chrome-devtools-mcp
      const result = await chromeDevtoolsClient.callTool({
        name: toolName,
        arguments: args,
      });

      // Lock stays "agent" for the entire session — only browser_stop resets it
      state.session.status = "ready";

      const resObj = result as { content: { type: "text"; text: string }[] };
      if (resObj && Array.isArray(resObj.content)) {
        resObj.content.push({
          type: "text",
          text: "\n\nCRITICAL SYSTEM REMINDER: If you have completely finished the user's request, you MUST call the `browser_done` tool NOW to release control of the browser. If you still have more steps to do, continue."
        });
      }

      return resObj;
    } catch (err) {
      state.session.status = "ready";
      
      const msg = (err as Error).message || String(err);
      const isDisconnect = msg.includes("fetch failed") || msg.includes("socket") || msg.includes("close") || msg.includes("disconnect") || msg.includes("ECONNREFUSED");
      
      if (isDisconnect) {
        log("Chromium CDP connection lost! Resetting state.", LogLevel.WARN);
        chromeDevtoolsClient = null;
        state.chrome.healthy = false;
        state.session.status = "idle";
      }

      return {
        content: [{ type: "text" as const, text: "Error: " + msg + (isDisconnect ? "\n\nThe browser disconnected. Your next tool call will automatically restart it." : "") }],
      }
    } finally {
      if (flagSet && chromeDevtoolsClient) {
        // Remove the flag so human users are blocked again.
        // We delay this slightly (100ms) to ensure trailing async events 
        // (like keyup or React synthetic events) have time to bubble 
        // through the DOM before the blocker re-engages.
        await sleep(100);
        await chromeDevtoolsClient.callTool({
          name: "evaluate_script",
          arguments: { function: "() => { document.documentElement.removeAttribute('data-bp-ai-acting'); }" }
        }).catch(() => {});
      }
    }
  } catch (err) {
    // This catches errors from httpRequest, addSidebarAction, etc.
    state.session.status = "ready";
    return {
      content: [{ type: "text" as const, text: "Error: " + ((err as Error).message || String(err)) }],
    };
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  if (cleanupDone) return;
  cleanupDone = true;

  log("Shutting down...");

  // Stop heartbeat
  stopHeartbeat();

  // Disconnect chrome-devtools-mcp
  if (chromeDevtoolsClient) {
    try {
      await chromeDevtoolsClient.close();
      log("Disconnected chrome-devtools-mcp");
    } catch {
      // Ignore
    }
    chromeDevtoolsClient = null;
  }

  // We intentionally DO NOT kill Chromium or the Server here.
  // In a multi-client environment (e.g. OpenCode + Cursor running simultaneously),
  // killing the shared server or browser would violently disconnect the other client.
  // The server/browser will self-terminate via the service worker heartbeat if 
  // all clients disconnect and the wrapper dies.
  // Hard manual kills are deferred to `web-mcp stop`.

  // End sidebar if active
  if (sidebarActive) {
    await httpRequest("POST", "/sidebar/end").catch(() => {});
  }

  // Update session state
  await httpRequest("POST", "/session/stop").catch(() => {});

  log("Cleanup complete");
}

// ─── MCP Server ──────────────────────────────────────────────────────────

const server = new McpServer({
  name: "web-mcp",
  version: "1.0.0",
});

// ─── Browser Control Tools (Static Registration) ─────────────────────────

// browser_start — INTERNAL, auto-start handles everything
server.tool(
  "browser_start",
  "INTERNAL TOOL — DO NOT CALL. The browser auto-starts automatically when you use browser_navigate, browser_click, browser_type, or any other action tool. Calling this tool is unnecessary and will restart the session. Only use if explicitly asked to start the browser.",
  {
    taskName: z.string().optional().describe("Description of the task the AI will perform"),
  },
  async ({ taskName }: { taskName?: string }) => {
    const name = taskName || "AI Browser Task";

    if (state.session.status === "ready" || state.session.status === "running") {
      return {
        content: [{ type: "text" as const, text: "Browser already running. Session status: " + state.session.status }],
      };
    }

    state.session.status = "launching";
    state.session.taskName = name;

    const ready = await ensureBrowserReady();
    if (!ready.ok) {
      return {
        content: [{ type: "text" as const, text: "ERROR: " + ready.error + "\n\nCRITICAL AI INSTRUCTION: DO NOT attempt to fix this by killing the Chromium process manually (e.g. Stop-Process or taskkill), and DO NOT try to rebuild the extension using npm commands. Simply report this exact error to the user and await instructions." }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: "Browser started successfully.\n\nServer: http://localhost:" + config.server.port +
          "\nChrome: http://127.0.0.1:" + config.chrome.port +
          "\nExtension: Auto-loaded via --load-extension\nSession: Ready" +
          "\n\nYou can now use browser tools (browser_navigate, browser_click, browser_type, etc.).",
      }],
    };
  }
);

// browser_stop — explicit stop
server.tool(
  "browser_stop",
  "Stop the browser and server. Ends the AI control session.",
  {},
  async () => {
    // Disconnect chrome-devtools-mcp
    if (chromeDevtoolsClient) {
      try {
        await chromeDevtoolsClient.close();
      } catch {
        // Ignore
      }
      chromeDevtoolsClient = null;
    }

    // End sidebar
    await endSidebar();

    // Stop session
    await httpRequest("POST", "/session/stop");

    // We intentionally DO NOT kill Chromium or the Server here.
    // In a multi-client environment (e.g. OpenCode + Cursor running simultaneously),
    // killing the shared server or browser would violently disconnect the other client.
    // The server/browser will self-terminate via the service worker heartbeat if 
    // all clients disconnect and the wrapper dies.
    // Hard manual kills are deferred to `web-mcp stop`.

    // Reset state
    state.server = { running: false, healthy: false, weStarted: false, process: null, pid: null };
    state.chrome = { running: false, healthy: false, weStarted: false, pid: null };
    state.session = { status: "idle", taskName: null };
    sidebarActive = false;
    sidebarTaskName = null;

    return {
      content: [{ type: "text" as const, text: "Browser stopped. Session ended." }],
    };
  }
);

// browser_done — signal task completion, hide sidebar, release lock
// Does NOT kill Chromium or server — session can be resumed on next tool call
server.tool(
  "browser_done",
  "CRITICAL: You MUST call this tool immediately when you have finished the user's request, before you give your final text response. This releases the lock, hides the AI overlay, and gives control back to the user.",
  {},
  async () => {
    // End sidebar
    await endSidebar();

    // Release lock (but keep session alive)
    await httpRequest("POST", "/session/lock", { owner: null, action: null });
    state.session.status = "idle";
    lastToolCallTime = 0;

    log("Task complete — sidebar hidden, lock released");

    return {
      content: [{ type: "text" as const, text: "Task complete. Browser control released. The sidebar is hidden but the browser stays open. Call any browser tool to resume." }],
    };
  }
);

// browser_get_status — get current state
server.tool(
  "browser_get_status",
  "Get current browser and session status.",
  {},
  async () => {
    const serverHealth = await checkServerHealth();
    const chromeHealth = await checkChromeHealth();
    const sessionStateResp = await httpRequest("GET", "/session/state");

    const lines = [
      "=== Web MCP Status ===",
      "",
      "Server: " + (serverHealth.healthy ? "✓ Healthy" : "✗ Not responding") + " (port " + config.server.port + ")",
      "Chromium: " + (chromeHealth.healthy ? "✓ Running" : "✗ Not running") + " (port " + config.chrome.port + ")",
      "Session: " + (sessionStateResp.status || state.session.status),
      "Task: " + (sessionStateResp.taskName || state.session.taskName || "None"),
      "Lock: " + (sessionStateResp.lockOwner || "None"),
      "",
      "chrome-devtools-mcp: " + (chromeDevtoolsClient ? "Connected" : "Not connected"),
    ];
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// browser_navigate — go to URL
server.tool(
  "browser_navigate",
  "Navigate the browser to a URL. Auto-starts browser if needed.\n\nCRITICAL INSTRUCTION 1: DO NOT use this tool to cheat or skip steps! You are simulating a real human user. Only use browser_navigate for the initial entry point (e.g., google.com or the app homepage), and then you MUST use browser_click, browser_type, etc., to navigate through the website manually.\n\nCRITICAL INSTRUCTION 2: When you have completely finished fulfilling the user's entire request, you MUST call browser_done to release control of the browser! Do not forget!",
  {
    url: z.string().describe("The URL to navigate to"),
  },
  async ({ url }: { url: string }) => {
    return callChromeDevtoolsTool(
      "navigate_page",
      { url },
      "Navigating to " + url,
      "navigate"
    );
  }
);

// browser_click — click an element
server.tool(
  "browser_click",
  "Click an element on the page. Use browser_snapshot first to get element UIDs.\n\nCRITICAL INSTRUCTION: When you have completely finished fulfilling the user's entire request, you MUST call browser_done to release control of the browser! Do not forget!",
  {
    uid: z.string().describe("Element UID from snapshot (e.g., 'a[1]', 'button[2]')"),
  },
  async ({ uid }: { uid: string }) => {
    return callChromeDevtoolsTool(
      "click",
      { uid },
      "Clicking element (" + uid + ")",
      "click"
    );
  }
);

// browser_type — type text (with optional submit key)
server.tool(
  "browser_type",
  "Type text into the currently focused element. Optionally press a key after typing to submit forms.\n\nCRITICAL INSTRUCTION 1: This tool DOES NOT take a 'uid' parameter! It blindly types into whatever is currently focused. You MUST use browser_click on an input field first to focus it, before calling this tool! Alternatively, use browser_fill instead.\n\nCRITICAL INSTRUCTION 2: When you have completely finished fulfilling the user's entire request, you MUST call browser_done to release control of the browser! Do not forget!",
  {
    text: z.string().describe("Text to type"),
    submitKey: z.string().optional().describe("Optional key to press after typing (e.g., 'Enter', 'Tab', 'Escape'). Use this to submit forms after typing."),
  },
  async ({ text, submitKey }: { text: string; submitKey?: string }) => {
    // Type the text first
    const result = await callChromeDevtoolsTool(
      "type_text",
      { text },
      "Typing: \"" + String(text).substring(0, 30) + "\"",
      "type"
    );

    // If submitKey provided, press it separately (more reliable than passing to type_text)
    if (submitKey) {
      await callChromeDevtoolsTool(
        "press_key",
        { key: submitKey },
        "Pressing: " + submitKey,
        "keypress"
      );
    }

    return result;
  }
);

// browser_fill — fill an input field
server.tool(
  "browser_fill",
  "Fill a specific input field by element UID.\n\nCRITICAL INSTRUCTION: When you have completely finished fulfilling the user's entire request, you MUST call browser_done to release control of the browser! Do not forget!",
  {
    uid: z.string().describe("Element UID of the input field"),
    value: z.string().describe("Value to fill in the field"),
  },
  async ({ uid, value }: { uid: string; value: string }) => {
    // Override chrome-devtools-mcp "fill" because it doesn't trigger React onChange properly
    // 1. Click to focus (silent)
    await callChromeDevtoolsTool("click", { uid }, null, "click");
    
    // 2. Clear input using JS (triggers React)
    const clearJs = `() => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.value = '';
        const tracker = el._valueTracker;
        if (tracker) tracker.setValue('');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }`;
    await callChromeDevtoolsTool("evaluate_script", { function: clearJs }, null, "evaluate");
    
    // 3. Type new value
    return callChromeDevtoolsTool(
      "type_text",
      { text: value },
      `Filling (${uid}): "${String(value).substring(0, 30)}"`,
      "fill"
    );
  }
);

// browser_scroll — scroll the page (uses evaluate_script since chrome-devtools-mcp has no scroll tool)
server.tool(
  "browser_scroll",
  "Scroll the page up or down.",
  {
    direction: z.enum(["up", "down"]).optional().describe("Direction to scroll (default: down)"),
    amount: z.number().optional().describe("Amount to scroll in pixels (default: 500)"),
  },
  async ({ direction, amount }: { direction?: string; amount?: number }) => {
    const pixels = amount || 500;
    const dy = direction === "up" ? -pixels : pixels;
    return callChromeDevtoolsTool(
      "evaluate_script",
      { function: `() => { window.scrollBy(0, ${dy}); }` },
      "Scrolling " + (direction || "down") + " " + pixels + "px",
      "scroll"
    );
  }
);

// browser_screenshot — take a screenshot
server.tool(
  "browser_screenshot",
  "Take a screenshot of the current page.\n\nCRITICAL INSTRUCTION: When you have completely finished fulfilling the user's entire request, you MUST call browser_done to release control of the browser! Do not forget!",
  {
    fullPage: z.boolean().optional().describe("Capture full page (true) or viewport only (false, default)"),
  },
  async ({ fullPage }: { fullPage?: boolean }) => {
    return callChromeDevtoolsTool(
      "take_screenshot",
      { fullPage: fullPage || false },
      "Taking screenshot",
      "screenshot"
    );
  }
);

// browser_snapshot — get page content
server.tool(
  "browser_snapshot",
  "Get the current page content as a DOM/accessibility snapshot. Use this to find element UIDs for clicking.\n\nCRITICAL INSTRUCTION: When you have completely finished fulfilling the user's entire request, you MUST call browser_done to release control of the browser! Do not forget!",
  {},
  async () => {
    return callChromeDevtoolsTool(
      "take_snapshot",
      {},
      "Reading page content",
      "snapshot"
    );
  }
);

// browser_press_key — press a keyboard key
server.tool(
  "browser_press_key",
  "Press a keyboard key (e.g., Enter, Tab, Escape).\n\nCRITICAL INSTRUCTION: When you have completely finished fulfilling the user's entire request, you MUST call browser_done to release control of the browser! Do not forget!",
  {
    key: z.string().describe("Key to press (e.g., 'Enter', 'Tab', 'Escape', 'ArrowDown')"),
  },
  async ({ key }: { key: string }) => {
    return callChromeDevtoolsTool(
      "press_key",
      { key },
      "Pressing: " + key,
      "keypress"
    );
  }
);

// browser_wait — wait for text or time
server.tool(
  "browser_wait",
  "Wait for text to appear on the page or wait a specific time.",
  {
    text: z.string().optional().describe("Text to wait for on the page"),
    time: z.number().optional().describe("Time to wait in milliseconds"),
  },
  async ({ text, time }: { text?: string; time?: number }) => {
    if (text) {
      return callChromeDevtoolsTool(
        "wait_for",
        { text },
        "Waiting for: " + text,
        "default"
      );
    }
    // Simple time wait
    await sleep(time || 1000);
    return {
      content: [{ type: "text" as const, text: "Waited " + (time || 1000) + "ms" }],
    };
  }
);

// browser_evaluate — run JavaScript
server.tool(
  "browser_evaluate",
  "Execute JavaScript code in the browser page.",
  {
    script: z.string().describe("JavaScript code to execute"),
  },
  async ({ script }: { script: string }) => {
    return callChromeDevtoolsTool(
      "evaluate_script",
      { function: `async () => { ${script} }` },
      "Executing JavaScript",
      "script"
    );
  }
);

// browser_new_tab — open new tab
server.tool(
  "browser_new_tab",
  "Open a new browser tab, optionally navigating to a URL.",
  {
    url: z.string().optional().describe("URL to open in the new tab"),
  },
  async ({ url }: { url?: string }) => {
    return callChromeDevtoolsTool(
      "new_page",
      { url: url || "" },
      "Opening new tab" + (url ? ": " + url : ""),
      "navigate"
    );
  }
);

// browser_close_tab — close a tab
server.tool(
  "browser_close_tab",
  "Close a browser tab. Use browser_get_tabs first to get the tab ID (pageId).",
  {
    tabId: z.number().optional().describe("Tab ID (pageId) to close, from browser_get_tabs. Default: current tab."),
  },
  async ({ tabId }: { tabId?: number }) => {
    return callChromeDevtoolsTool(
      "close_page",
      tabId !== undefined ? { pageId: tabId } : {},
      "Closing tab (pageId=" + (tabId !== undefined ? tabId : "current") + ")",
      "default"
    );
  }
);

// browser_switch_tab — switch to a tab
server.tool(
  "browser_switch_tab",
  "Switch to a specific browser tab. Use browser_get_tabs first to get the tab ID (pageId).",
  {
    tabId: z.number().describe("Tab ID (pageId) to switch to, from browser_get_tabs"),
  },
  async ({ tabId }: { tabId: number }) => {
    return callChromeDevtoolsTool(
      "select_page",
      { pageId: tabId },
      "Switching to tab (pageId=" + tabId + ")",
      "default"
    );
  }
);

// browser_get_tabs — list open tabs
server.tool(
  "browser_get_tabs",
  "List all open browser tabs.",
  {},
  async () => {
    return callChromeDevtoolsTool(
      "list_pages",
      {},
      "Listing tabs",
      "default"
    );
  }
);

// browser_get_url — get current URL
server.tool(
  "browser_get_url",
  "Get the URL of the current page.",
  {},
  async () => {
    return callChromeDevtoolsTool(
      "evaluate_script",
      { function: "() => window.location.href" },
      "Getting current URL",
      "default"
    );
  }
);

// browser_hover — hover over an element
server.tool(
  "browser_hover",
  "Hover over an element on the page.",
  {
    uid: z.string().describe("Element UID from snapshot"),
  },
  async ({ uid }: { uid: string }) => {
    return callChromeDevtoolsTool(
      "hover",
      { uid },
      "Hovering over element (" + uid + ")",
      "hover"
    );
  }
);

// browser_drag — drag from one element to another
server.tool(
  "browser_drag",
  "Drag from one element to another.",
  {
    fromUid: z.string().describe("Source element UID"),
    toUid: z.string().describe("Target element UID"),
  },
  async ({ fromUid, toUid }: { fromUid: string; toUid: string }) => {
    return callChromeDevtoolsTool(
      "drag",
      { from_uid: fromUid, to_uid: toUid },
      "Dragging from (" + fromUid + ") to (" + toUid + ")",
      "drag"
    );
  }
);

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log("Starting Web MCP MCP server...");

  // Load config
  config = loadConfig();

  // Start MCP server IMMEDIATELY — don't wait for chrome-devtools-mcp
  // Tools will auto-connect on first call via ensureBrowserReady()
  log("Starting MCP server on stdio...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP server ready — 21 tools registered");

  // Idle timeout — auto-close sidebar if no tool calls for 90 seconds
  setInterval(async () => {
    if (lastToolCallTime > 0 && Date.now() - lastToolCallTime > BROWSER_IDLE_TIMEOUT_MS) {
      log("Idle timeout — auto-closing sidebar (no tool calls for " + (BROWSER_IDLE_TIMEOUT_MS / 1000) + "s)");
      lastToolCallTime = 0;
      await endSidebar();
      await httpRequest("POST", "/session/lock", { owner: null, action: null });
      state.session.status = "idle";
    }
  }, 10_000);

  // Setup cleanup handlers
  process.on("SIGINT", async () => { await cleanup(); process.exit(0); });
  process.on("SIGTERM", async () => { await cleanup(); process.exit(0); });
  process.on("exit", () => {
    stopHeartbeat();
    if (state.server.process) {
      try { state.server.process.kill(); } catch {}
    }
  });
}

main().catch((err: Error) => {
  log("Fatal error: " + err.message, LogLevel.ERROR);
  cleanup().finally(() => process.exit(1));
});

