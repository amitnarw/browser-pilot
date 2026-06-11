import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG = {
  server: { port: 3026 },
  chrome: { port: 9222, executable: "auto-detect", profileDir: path.join(CONFIG_DIR, "chrome-profile") },
  logging: { level: "info" },
};

export async function run(): Promise<void> {
  console.log("");
  console.log("Web MCP Setup");
  console.log("==================");
  console.log("");

  // 1. Create config directory
  console.log("[1/3] Creating config directory...");
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log("      Created " + CONFIG_FILE);
  } else {
    console.log("      Config already exists");
  }
  console.log("");

  // 2. Configure OpenCode
  console.log("[2/3] Configuring OpenCode...");
  configureOpenCode();
  console.log("");

  // 3. Done
  console.log("[3/3] Setup complete!");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Run: opencode");
  console.log("  2. Ask the AI to browse the web");
  console.log("  3. The AI will call browser_start to open Chrome");
  console.log("  4. Chrome extension auto-loads via --load-extension");
  console.log("");
}

function configureOpenCode(): void {
  // Try common OpenCode config locations
  const possiblePaths = [
    path.join(os.homedir(), ".config", "opencode", "opencode.json"),
    path.join(os.homedir(), ".opencode", "opencode.json"),
    path.join(os.homedir(), "opencode.json"),
  ];

  let configPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    // Create default config
    configPath = possiblePaths[0];
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    console.log("      No OpenCode config found, creating at " + configPath);
  } else {
    console.log("      Found config at " + configPath);
  }

  // Read or create config
  let config: Record<string, any> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      console.log("      WARNING: Could not parse config, will overwrite");
    }
  }

  if (!config.mcp) config.mcp = {};

  // Calculate wrapper path (relative to this CLI file's compiled output)
  // Use .min.js (bundled) if available, otherwise fall back to .js (development)
  const wrapperMinPath = path.join(__dirname, "..", "mcp", "wrapper.min.js");
  const wrapperDevPath = path.join(__dirname, "..", "mcp", "wrapper.js");
  const wrapperPath = fs.existsSync(wrapperMinPath) ? wrapperMinPath : wrapperDevPath;

  // Check if already configured
  if (config.mcp["web-mcp"]) {
    const existing = config.mcp["web-mcp"];
    if (existing.command && existing.command[1] === wrapperPath) {
      console.log("      Web MCP already configured ✓");
      return;
    }
  }

  config.mcp["web-mcp"] = {
    type: "local",
    command: ["node", wrapperPath],
    enabled: true,
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("      Added web-mcp entry to OpenCode config ✓");
  console.log("      Wrapper: " + wrapperPath);
}
