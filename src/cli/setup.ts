import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG = {
  server: { port: 3026 },
  chrome: { port: 9222, executable: "auto-detect", profileDir: path.join(CONFIG_DIR, "chrome-profile") },
  logging: { level: "info" },
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

export async function run(): Promise<void> {
  console.clear();
  console.log("\x1b[1m\x1b[36mWeb MCP Setup\x1b[0m\n");

  console.log("Creating config directory...");
  await new Promise((r) => setTimeout(r, 800)); 
  
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }
  console.log("✓ Config directory ready");

  console.log("\nWhich AI client would you like to configure?");
  console.log("  1. OpenCode");
  console.log("  2. Claude Desktop");
  console.log("  3. Claude Code (CLI)");
  console.log("  4. Cursor");
  console.log("  5. Antigravity IDE");
  console.log("  6. Roo Code (Cline)");
  console.log("  7. Other (Manual Setup)");
  console.log("  8. Cancel");

  const choice = await question("\nEnter choice (1-8): ");
  let configPath = "";

  if (choice === "1") {
    configPath = path.join(os.homedir(), ".opencode.json"); // Safest cross-platform global path for OpenCode
  } else if (choice === "2") {
    if (process.platform === "win32") {
      configPath = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
    } else {
      configPath = path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
    }
  } else if (choice === "3") {
    configPath = path.join(os.homedir(), ".claude.json");
  } else if (choice === "4") {
    configPath = path.join(os.homedir(), ".cursor", "mcp.json");
  } else if (choice === "5") {
    configPath = path.join(os.homedir(), ".gemini", "antigravity", "mcp_config.json");
  } else if (choice === "6") {
    if (process.platform === "win32") {
      configPath = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");
    } else if (process.platform === "darwin") {
      configPath = path.join(os.homedir(), "Library", "Application Support", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");
    } else {
      configPath = path.join(os.homedir(), ".config", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");
    }
  } else if (choice === "7") {
    console.log("\nTo manually install Web MCP in your client, add the following configuration to your MCP settings file:\n");
    const manualConfig = {
      "mcpServers": {
        "web-mcp": {
          "command": "npx",
          "args": ["-y", "@amitnarw/web-mcp", "mcp"]
        }
      }
    };
    console.log(JSON.stringify(manualConfig, null, 2) + "\n");
    rl.close();
    return;
  } else {
    console.log("Setup cancelled.");
    rl.close();
    return;
  }

  console.log(`\nConfiguring ${configPath}...`);
  await new Promise((r) => setTimeout(r, 1000));
  
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let config: Record<string, any> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      // Ignore
    }
  }

  if (!config.mcpServers) config.mcpServers = {};
  
  if (choice === "1") {
    if (!config.mcp) config.mcp = {};
    config.mcp["web-mcp"] = {
      type: "local",
      command: ["npx", "-y", "@amitnarw/web-mcp", "mcp"],
      enabled: true,
    };
  } else {
    config.mcpServers["web-mcp"] = {
      command: "npx",
      args: ["-y", "@amitnarw/web-mcp", "mcp"],
    };
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(`✓ Added web-mcp to ${configPath}\n`);
  
  console.log("Setup complete!\n");
  console.log("Next steps:");
  console.log("  1. Restart your AI client");
  console.log("  2. Ask the AI: \"Go to google.com and search for Opencode\"");
  
  rl.close();
}
