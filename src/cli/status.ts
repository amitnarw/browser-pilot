import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const PID_FILE = path.join(CONFIG_DIR, "server.pid");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

let SERVER_PORT = 3026;
let CHROME_PORT = 9222;

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (config?.server?.port) SERVER_PORT = config.server.port;
    if (config?.chrome?.port) CHROME_PORT = config.chrome.port;
  } catch {}
}

export async function getStatus(): Promise<string[]> {
  const lines: string[] = [];
  
  lines.push("\x1b[1mWeb MCP Status\x1b[0m");
  lines.push("\x1b[90m===================\x1b[0m");

  // Check server
  let serverRunning = false;
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid, 0);
        serverRunning = true;
        lines.push("Server:  Running (PID: " + pid + ")");
      } catch {
        lines.push("Server:  Not running (stale PID file)");
      }
    }
  }
  if (!serverRunning) {
    lines.push("Server:  Not running");
  }

  // Check server health
  try {
    const resp = await fetch("http://localhost:" + SERVER_PORT + "/.identity", { signal: AbortSignal.timeout(1000) });
    const data = await resp.json() as any;
    lines.push("         Health: " + (data.identity === "web-mcp-server" ? "\x1b[32mHealthy\x1b[0m" : "\x1b[33mUnknown\x1b[0m"));
  } catch {
    lines.push("         Health: \x1b[31mNot responding\x1b[0m");
  }

  // Check Chrome
  try {
    const resp = await fetch("http://127.0.0.1:" + CHROME_PORT + "/json/version", { signal: AbortSignal.timeout(1000) });
    const data = await resp.json() as any;
    lines.push("Chrome:  Running (port " + CHROME_PORT + ")");
    lines.push("         Browser: " + (data.browser || "Unknown"));
  } catch {
    lines.push("Chrome:  Not running");
  }

  // Check config
  const configFile = path.join(CONFIG_DIR, "config.json");
  lines.push("Config:  " + (fs.existsSync(configFile) ? configFile : "Not found"));

  // Check OpenCode config
  const possiblePaths = [
    path.join(os.homedir(), ".config", "opencode", "opencode.json"),
    path.join(os.homedir(), ".opencode", "opencode.json"),
  ];
  let opencodeConfigured = false;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const config = JSON.parse(fs.readFileSync(p, "utf8"));
        if (config.mcp && config.mcp["web-mcp"]) {
          opencodeConfigured = true;
          lines.push("OpenCode: Configured ✓");
          break;
        }
      } catch {}
    }
  }
  if (!opencodeConfigured) {
    lines.push("OpenCode: Not configured (run: Setup)");
  }

  return lines;
}
