import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const PID_FILE = path.join(CONFIG_DIR, "server.pid");
const SERVER_PORT = 3026;
const CHROME_PORT = 9222;

export async function run(): Promise<void> {
  console.log("");
  console.log("Web MCP Status");
  console.log("===================");
  console.log("");

  // Check server
  let serverRunning = false;
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid, 0); // Check if process exists
        serverRunning = true;
        console.log("Server:  Running (PID: " + pid + ")");
      } catch {
        console.log("Server:  Not running (stale PID file)");
      }
    }
  }
  if (!serverRunning) {
    console.log("Server:  Not running");
  }

  // Check server health
  try {
    const resp = await fetch("http://localhost:" + SERVER_PORT + "/.identity", { signal: AbortSignal.timeout(3000) });
    const data = await resp.json() as any;
    console.log("         Health: " + (data.identity === "web-mcp-server" ? "Healthy" : "Unknown"));
  } catch {
    console.log("         Health: Not responding");
  }

  // Check Chrome
  try {
    const resp = await fetch("http://127.0.0.1:" + CHROME_PORT + "/json/version", { signal: AbortSignal.timeout(3000) });
    const data = await resp.json() as any;
    console.log("Chrome:  Running (port " + CHROME_PORT + ")");
    console.log("         Browser: " + (data.browser || "Unknown"));
  } catch {
    console.log("Chrome:  Not running");
  }

  // Check config
  const configFile = path.join(CONFIG_DIR, "config.json");
  console.log("Config:  " + (fs.existsSync(configFile) ? configFile : "Not found"));

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
          console.log("OpenCode: Configured ✓");
          break;
        }
      } catch {}
    }
  }
  if (!opencodeConfigured) {
    console.log("OpenCode: Not configured (run: web-mcp setup)");
  }

  console.log("");
}
