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
  chrome: { port: 9222, executable: "auto-detect", profileDir: path.join(CONFIG_DIR, "chrome-profile-v2") },
  logging: { level: "info" },
};

export const SETUP_OPTIONS = [
  { value: "opencode", label: "OpenCode" },
  { value: "claude-desktop", label: "Claude Desktop" },
  { value: "claude-code", label: "Claude Code (CLI)" },
  { value: "cursor", label: "Cursor" },
  { value: "antigravity", label: "Antigravity IDE" },
  { value: "roo-code", label: "Roo Code (Cline)" },
  { value: "manual", label: "Other (Manual Setup)" },
  { value: "cancel", label: "Cancel" }
];

export const UNINSTALL_OPTIONS = [
  { value: "all", label: "Uninstall from ALL clients" },
  { value: "opencode", label: "OpenCode" },
  { value: "claude-desktop", label: "Claude Desktop" },
  { value: "claude-code", label: "Claude Code (CLI)" },
  { value: "cursor", label: "Cursor" },
  { value: "antigravity", label: "Antigravity IDE" },
  { value: "roo-code", label: "Roo Code (Cline)" },
  { value: "cancel", label: "Cancel" }
];

function getConfigPath(choiceValue: string): string {
  if (choiceValue === "opencode") {
    // OpenCode stores its global config here
    return path.join(os.homedir(), ".config", "opencode", "opencode.json");
  } else if (choiceValue === "claude-desktop") {
    if (process.platform === "win32") {
      return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
    } else {
      return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
    }
  } else if (choiceValue === "claude-code") {
    return path.join(os.homedir(), ".claude.json");
  } else if (choiceValue === "cursor") {
    return path.join(os.homedir(), ".cursor", "mcp.json");
  } else if (choiceValue === "antigravity") {
    return path.join(os.homedir(), ".gemini", "antigravity", "mcp_config.json");
  } else if (choiceValue === "roo-code") {
    if (process.platform === "win32") {
      return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");
    } else if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Application Support", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");
    } else {
      return path.join(os.homedir(), ".config", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");
    }
  }
  return "";
}

export function getConfiguredClients(): string[] {
  const configured: string[] = [];
  
  for (const opt of SETUP_OPTIONS) {
    if (opt.value === "manual" || opt.value === "cancel") continue;
    
    const p = getConfigPath(opt.value);
    if (p && fs.existsSync(p)) {
      try {
        const config = JSON.parse(fs.readFileSync(p, "utf8"));
        if (opt.value === "opencode" && config?.mcp?.["web-mcp"]) {
          configured.push(opt.value);
        } else if (config?.mcpServers?.["web-mcp"]) {
          configured.push(opt.value);
        }
      } catch {}
    }
  }
  
  return configured;
}

export async function testConfigurations(): Promise<string[]> {
  const lines: string[] = [];
  lines.push("\x1b[1mConfiguration Test Report\x1b[0m");
  lines.push("\x1b[90m=========================\x1b[0m");
  
  let anyFound = false;

  for (const opt of SETUP_OPTIONS) {
    if (opt.value === "manual" || opt.value === "cancel") continue;
    
    const p = getConfigPath(opt.value);
    if (!p) continue;
    
    if (fs.existsSync(p)) {
      let status = "";
      try {
        const content = fs.readFileSync(p, "utf8");
        const config = JSON.parse(content);
        
        let mcpDef = null;
        if (opt.value === "opencode") {
          mcpDef = config?.mcp?.["web-mcp"];
        } else {
          mcpDef = config?.mcpServers?.["web-mcp"];
        }
        
        if (!mcpDef) {
          status = "\x1b[33mFile exists, but web-mcp not added\x1b[0m";
        } else {
          const cmd = mcpDef.command;
          const isCommandValid = (opt.value === "opencode" && Array.isArray(cmd) && (cmd.includes("npx") || cmd.includes("web-mcp"))) ||
                                 (cmd === "npx" || cmd === "web-mcp");
          if (isCommandValid) {
            status = "\x1b[32mWorking [✓]\x1b[0m";
            anyFound = true;
          } else {
            status = "\x1b[31mBroken (Invalid command syntax)\x1b[0m";
          }
        }
      } catch (e) {
        status = "\x1b[31mBroken (Invalid JSON format)\x1b[0m";
      }
      lines.push(`${opt.label.padEnd(20)} : ${status}`);
    } else {
      lines.push(`${opt.label.padEnd(20)} : \x1b[90mNot Installed / No Config File\x1b[0m`);
    }
  }
  
  if (anyFound) {
    lines.push("");
    lines.push("\x1b[32mAll working clients are ready to use!\x1b[0m");
  }

  return lines;
}

export async function uninstallClient(choiceValue: string): Promise<string[]> {
  const lines: string[] = [];
  lines.push("\x1b[1mUninstall Report\x1b[0m");
  lines.push("\x1b[90m=========================\x1b[0m");

  const clientsToRemove = choiceValue === "all" 
    ? SETUP_OPTIONS.map(o => o.value).filter(v => v !== "manual" && v !== "cancel") 
    : [choiceValue];

  let removedCount = 0;

  for (const client of clientsToRemove) {
    const p = getConfigPath(client);
    if (!p || !fs.existsSync(p)) continue;

    try {
      const content = fs.readFileSync(p, "utf8");
      const config = JSON.parse(content);
      let modified = false;

      if (client === "opencode") {
        if (config?.mcp?.["web-mcp"]) {
          delete config.mcp["web-mcp"];
          modified = true;
        }
        // Fix strict validation crash caused by previous buggy setups
        if (config.hasOwnProperty("mcpServers")) {
          delete config.mcpServers;
          modified = true;
        }
      } else if (config?.mcpServers?.["web-mcp"]) {
        delete config.mcpServers["web-mcp"];
        modified = true;
      }

      if (modified) {
        const tempP = p + ".tmp." + Date.now();
        fs.writeFileSync(tempP, JSON.stringify(config, null, 2));
        fs.renameSync(tempP, p);
        lines.push(`\x1b[32m✓ Removed from ${client}\x1b[0m`);
        removedCount++;
      }
    } catch (e) {
      lines.push(`\x1b[31m✗ Failed to process ${client}\x1b[0m`);
    }
  }

  if (removedCount === 0) {
    lines.push("\x1b[33mNo web-mcp configurations found to remove.\x1b[0m");
  } else {
    lines.push("");
    lines.push("\x1b[32mClient uninstall complete.\x1b[0m");
  }

  // If uninstalling from ALL clients, also wipe out the local Web MCP app data (profiles, logs, etc)
  if (choiceValue === "all") {
    try {
      if (fs.existsSync(CONFIG_DIR)) {
        fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
        lines.push(`\x1b[32m✓ Removed local Web MCP data (~/.web-mcp)\x1b[0m`);
      }
    } catch (e) {
      lines.push(`\x1b[31m✗ Failed to remove local Web MCP data (files might be locked)\x1b[0m`);
    }
  }

  lines.push("\x1b[32mPlease restart your AI clients.\x1b[0m");

  return lines;
}

export async function configureClient(choiceValue: string): Promise<string[]> {
  const lines: string[] = [];
  
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    const tempConfig = CONFIG_FILE + ".tmp." + Date.now();
    fs.writeFileSync(tempConfig, JSON.stringify(DEFAULT_CONFIG, null, 2));
    fs.renameSync(tempConfig, CONFIG_FILE);
  }

  const configPath = getConfigPath(choiceValue);

  if (choiceValue === "manual") {
    lines.push("\x1b[1mManual Setup Instructions\x1b[0m");
    lines.push("Add the following to your MCP settings file:");
    lines.push("");
    lines.push(`{
  "mcpServers": {
    "web-mcp": {
      "command": "web-mcp",
      "args": ["mcp"]
    }
  }
}`);
    return lines;
  } else if (!configPath) {
    return [];
  }

  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let config: Record<string, any> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {}
  }

  if (choiceValue === "opencode") {
    if (!config.mcp) config.mcp = {};
    config.mcp["web-mcp"] = {
      type: "local",
      command: ["web-mcp", "mcp"],
      enabled: true,
    };
  } else {
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers["web-mcp"] = {
      command: "web-mcp",
      args: ["mcp"],
    };
  }

  const tempConfigPath = configPath + ".tmp." + Date.now();
  fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
  fs.renameSync(tempConfigPath, configPath);
  
  lines.push(`\x1b[32m✓ Successfully added web-mcp to:\x1b[0m`);
  lines.push(`  ${configPath}`);
  lines.push("");
  lines.push("Next steps:");
  lines.push("  1. Restart your AI client");
  lines.push("  2. Ask the AI: \"Go to google.com and search for OpenCode\"");
  
  return lines;
}
