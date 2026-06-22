import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Only attempt to run the stop command if the project has been built (i.e. installed globally from NPM).
  // This prevents local `npm install` during development from crashing if `dist` doesn't exist yet.
  const stopScript = path.join(__dirname, '..', 'dist', 'cli', 'stop.min.js');
  if (fs.existsSync(stopScript)) {
    console.log("Stopping old Web MCP background processes (if any)...");
    execSync(`node "${path.join(__dirname, 'web-mcp.js')}" stop`, { stdio: 'ignore' });
  }
} catch (e) {
  // Ignore any errors to ensure we never break the user's NPM installation process
}
