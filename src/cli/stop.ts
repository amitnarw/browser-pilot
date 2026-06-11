import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync, spawn } from "child_process";

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const PID_FILE = path.join(CONFIG_DIR, "server.pid");

export async function run(): Promise<void> {
  console.log("");
  console.log("Web MCP Stop");
  console.log("=================");
  console.log("");

  // Stop server
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid, "SIGTERM");
        console.log("Stopped server (PID: " + pid + ")");
      } catch {
        console.log("Server process " + pid + " not running");
      }
    }
    try { fs.unlinkSync(PID_FILE); } catch {}
  } else {
    console.log("No server PID file found");
  }

  // Stop Chrome with our profile
  const profileDir = path.join(CONFIG_DIR, "chrome-profile").replace(/\\/g, "\\\\");
  try {
    execSync(
      "powershell -Command \"Get-CimInstance Win32_Process -Filter \\\"Name='chrome.exe'\\\" | Where-Object { $_.CommandLine -like '*" + profileDir + "*' } | Stop-Process -Force -ErrorAction SilentlyContinue\"",
      { timeout: 10000, stdio: "ignore" }
    );
    console.log("Stopped Chrome instances with Web MCP profile");
  } catch {
    console.log("No Chrome instances found with Web MCP profile");
  }

  console.log("");
  console.log("Done.");
}
