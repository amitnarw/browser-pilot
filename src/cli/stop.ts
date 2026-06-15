import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const PID_FILE = path.join(CONFIG_DIR, "server.pid");

export async function stopProcesses(): Promise<string[]> {
  const lines: string[] = [];
  
  lines.push("\x1b[1mWeb MCP Stop\x1b[0m");
  lines.push("\x1b[90m=================\x1b[0m");

  // Stop server
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid, "SIGTERM");
        lines.push("Stopped server (PID: " + pid + ")");
      } catch {
        lines.push("Server process " + pid + " not running");
      }
    }
    try { fs.unlinkSync(PID_FILE); } catch {}
  } else {
    lines.push("No server PID file found");
  }

  // Stop Chrome with our profile
  const profileDir = path.join(CONFIG_DIR, "chrome-profile");
  const winProfileDir = profileDir.replace(/\\/g, "\\\\");
  try {
    if (process.platform === "win32") {
      await execAsync(
        `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | Where-Object { $_.CommandLine -like '*${winProfileDir}*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`,
        { timeout: 10000 }
      );
    } else {
      // macOS / Linux
      await execAsync(`pkill -f "chrome.*\\.web-mcp/chrome-profile"`, { timeout: 10000 });
    }
    lines.push("Stopped Chrome instances with Web MCP profile");
  } catch {
    lines.push("No Chrome instances found with Web MCP profile");
  }

  return lines;
}
