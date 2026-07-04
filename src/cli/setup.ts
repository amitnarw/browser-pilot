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
  chrome: { port: 9222, executable: "auto-detect", profileDir: path.join(CONFIG_DIR, "chromium-profile-v2") },
  logging: { level: "info" },
};

export const SETUP_OPTIONS = [
  { value: "opencode", label: "OpenCode" },
  { value: "claude-desktop", label: "Claude Desktop" },
  { value: "claude-code", label: "Claude Code (CLI)" },
  { value: "cursor", label: "Cursor" },
  { value: "windsurf", label: "Windsurf (Codeium)" },
  { value: "zed", label: "Zed Editor" },
  { value: "cody", label: "Sourcegraph Cody" },
  { value: "chatgpt", label: "ChatGPT Desktop (OpenAI)" },
  { value: "openai-codex", label: "OpenAI Codex" },
  { value: "antigravity", label: "Antigravity IDE" },
  { value: "cline", label: "Cline" },
  { value: "manual", label: "Other (Manual Setup)" },
  { value: "cancel", label: "Cancel" }
];

export const UNINSTALL_OPTIONS = [
  { value: "all", label: "Uninstall from ALL clients" },
  { value: "opencode", label: "OpenCode" },
  { value: "claude-desktop", label: "Claude Desktop" },
  { value: "claude-code", label: "Claude Code (CLI)" },
  { value: "cursor", label: "Cursor" },
  { value: "windsurf", label: "Windsurf (Codeium)" },
  { value: "zed", label: "Zed Editor" },
  { value: "cody", label: "Sourcegraph Cody" },
  { value: "antigravity", label: "Antigravity IDE" },
  { value: "cline", label: "Cline" },
  { value: "cancel", label: "Cancel" }
];

function getConfigPath(choiceValue: string): string {
  if (choiceValue === "opencode") {
    return path.join(os.homedir(), ".config", "opencode", "opencode.json");
  } else if (choiceValue === "claude-desktop") {
    if (process.platform === "win32") {
      return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
    } else if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
    } else {
      return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
    }
  } else if (choiceValue === "claude-code") {
    // Claude Code: user-scoped MCP goes in ~/.claude.json per Anthropic docs
    // (Project scope uses .mcp.json, local scope uses ~/.claude.json)
    const canonicalPath = path.join(os.homedir(), ".claude.json");
    const legacyPath = path.join(os.homedir(), ".claude", "settings.json");
    return fs.existsSync(canonicalPath) ? canonicalPath : legacyPath;
  } else if (choiceValue === "cursor") {
    return path.join(os.homedir(), ".cursor", "mcp.json");
  } else if (choiceValue === "windsurf") {
    return path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
  } else if (choiceValue === "zed") {
    if (process.platform === "win32") {
      // Zed on Windows uses APPDATA (Roaming), not LOCALAPPDATA
      return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Zed", "settings.json");
    } else if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Application Support", "Zed", "settings.json");
    } else {
      return path.join(os.homedir(), ".config", "zed", "settings.json");
    }
  } else if (choiceValue === "cody") {
    // Sourcegraph Cody stores MCP config in VS Code's global storage
    if (process.platform === "win32") {
      return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Code", "User", "globalStorage", "sourcegraph.cody-ai", "mcp_servers.json");
    } else if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Application Support", "Code", "User", "globalStorage", "sourcegraph.cody-ai", "mcp_servers.json");
    } else {
      return path.join(os.homedir(), ".config", "Code", "User", "globalStorage", "sourcegraph.cody-ai", "mcp_servers.json");
    }
  } else if (choiceValue === "antigravity") {
    return path.join(os.homedir(), ".gemini", "antigravity", "mcp_config.json");
  } else if (choiceValue === "cline") {
    // Cline IDE extension global MCP settings
    // Cline CLI uses ~/.cline/mcp.json (separate from extension config)
    return path.join(os.homedir(), ".cline", "data", "settings", "cline_mcp_settings.json");
  } else if (choiceValue === "openai-codex") {
    return path.join(os.homedir(), ".codex", "config.toml");
  }
  return "";
}

export function getConfiguredClients(): string[] {
  const configured: string[] = [];
  
  for (const opt of SETUP_OPTIONS) {
    if (opt.value === "manual" || opt.value === "cancel" || opt.value === "chatgpt") continue;
    
    const pathsToCheck = opt.value === "opencode"
      ? [getConfigPath(opt.value), path.join(os.homedir(), ".opencode.json")]
      : [getConfigPath(opt.value)];
    
    for (const p of pathsToCheck) {
      if (!p || !fs.existsSync(p)) continue;
      try {
        const content = fs.readFileSync(p, "utf8");
        if (opt.value === "openai-codex") {
          if (content.includes("[mcp_servers.web-mcp]")) {
            configured.push(opt.value);
          }
        } else {
          const config = JSON.parse(content);
          if (opt.value === "zed" && config?.context_servers?.["web-mcp"]) {
            configured.push(opt.value);
          } else if (opt.value === "opencode" && (config?.mcp?.["web-mcp"] || config?.mcpServers?.["web-mcp"])) {
            configured.push(opt.value);
          } else if (config?.mcpServers?.["web-mcp"]) {
            configured.push(opt.value);
          }
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
    if (opt.value === "manual" || opt.value === "cancel" || opt.value === "chatgpt") continue;
    
    const pathsToTest = opt.value === "opencode"
      ? [getConfigPath(opt.value), path.join(os.homedir(), ".opencode.json")]
      : [getConfigPath(opt.value)];
    
    let foundFile = false;
    for (const p of pathsToTest) {
      if (!p || !fs.existsSync(p)) continue;
      foundFile = true;
      let status = "";
      try {
        const content = fs.readFileSync(p, "utf8");
        if (opt.value === "openai-codex") {
          if (content.includes("[mcp_servers.web-mcp]")) {
             status = "\x1b[32mWorking [✓]\x1b[0m";
             anyFound = true;
          } else {
             status = "\x1b[33mFile exists, but web-mcp not added\x1b[0m";
          }
        } else {
          const config = JSON.parse(content);
          
          let mcpDef = null;
          if (opt.value === "zed") {
            mcpDef = config?.context_servers?.["web-mcp"];
          } else if (opt.value === "opencode") {
            mcpDef = config?.mcp?.["web-mcp"] || config?.mcpServers?.["web-mcp"];
          } else {
            mcpDef = config?.mcpServers?.["web-mcp"];
          }
          
          if (!mcpDef) {
            status = "\x1b[33mFile exists, but web-mcp not added\x1b[0m";
          } else {
            let isCommandValid = false;
            if (opt.value === "opencode") {
              const cmdArr = mcpDef.command;
              isCommandValid = Array.isArray(cmdArr) && cmdArr.length >= 2 && (cmdArr[0] === "npx" || cmdArr[0] === "web-mcp" || cmdArr[0] === "node");
            } else {
              const cmd = mcpDef.command;
              isCommandValid = cmd === "npx" || cmd === "web-mcp";
            }
            if (isCommandValid) {
              status = "\x1b[32mWorking [\u2713]\x1b[0m";
              anyFound = true;
            } else {
              status = "\x1b[31mBroken (Invalid command syntax)\x1b[0m";
            }
          }
        }
      } catch (e) {
        status = "\x1b[31mBroken (Invalid JSON format)\x1b[0m";
      }
      lines.push(`${opt.label.padEnd(25)} : ${status}`);
      break; // Only report one file per client
    }
    if (!foundFile) {
      lines.push(`${opt.label.padEnd(25)} : \x1b[90mNot Installed / No Config File\x1b[0m`);
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
    ? SETUP_OPTIONS.map(o => o.value).filter(v => v !== "manual" && v !== "cancel" && v !== "chatgpt") 
    : [choiceValue];

  let removedCount = 0;

  for (const client of clientsToRemove) {
    const pathsToProcess = client === "opencode"
      ? [getConfigPath(client), path.join(os.homedir(), ".opencode.json")]
      : [getConfigPath(client)];

    for (const p of pathsToProcess) {
      if (!p || !fs.existsSync(p)) continue;

      try {
        const content = fs.readFileSync(p, "utf8");
        
        if (client === "openai-codex") {
          if (content.includes("[mcp_servers.web-mcp]")) {
            const newContent = content.replace(/\[mcp_servers\.web-mcp\][\s\S]*?(?=\n\[|$)/g, "").trim() + "\n";
            const tempP = p + ".tmp." + Date.now();
            fs.writeFileSync(tempP, newContent);
            fs.renameSync(tempP, p);
            lines.push(`\x1b[32m✓ Removed from ${client}\x1b[0m`);
            removedCount++;
          }
        } else {
          const config = JSON.parse(content);
          let modified = false;

          if (client === "opencode") {
            if (config?.mcp?.["web-mcp"]) {
              delete config.mcp["web-mcp"];
              modified = true;
            }
            if (config?.mcpServers?.["web-mcp"]) {
              delete config.mcpServers["web-mcp"];
              modified = true;
            }
          } else if (client === "zed") {
            if (config?.context_servers?.["web-mcp"]) {
              delete config.context_servers["web-mcp"];
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
        }
      } catch (e) {
        lines.push(`\x1b[31m✗ Failed to process ${client}\x1b[0m`);
      }
    }
  }

  if (removedCount === 0) {
    lines.push("\x1b[33mNo web-mcp configurations found to remove.\x1b[0m");
  } else {
    lines.push("");
    lines.push("\x1b[32mClient uninstall complete.\x1b[0m");
  }

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

  const configPath = choiceValue === "opencode"
    ? path.join(os.homedir(), ".config", "opencode", "opencode.json")
    : getConfigPath(choiceValue);

  if (choiceValue === "manual") {
    lines.push("\x1b[1mManual Setup Instructions\x1b[0m");
    lines.push("For most clients (Claude, Cursor, Windsurf, etc.), add to your MCP config:");
    lines.push("");
    lines.push(`{`);
    lines.push(`  "mcpServers": {`);
    lines.push(`    "web-mcp": {`);
    lines.push(`      "type": "stdio",`);
    lines.push(`      "command": "npx",`);
    lines.push(`      "args": ["-y", "@amitnarw/web-mcp", "mcp"]`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push("");
    lines.push("For OpenCode, add to ~/.config/opencode/opencode.json:");
    lines.push("");
    lines.push(`{`);
    lines.push(`  "$schema": "https://opencode.ai/config.json",`);
    lines.push(`  "mcp": {`);
    lines.push(`    "web-mcp": {`);
    lines.push(`      "type": "local",`);
    lines.push(`      "command": ["npx", "-y", "@amitnarw/web-mcp", "mcp"],`);
    lines.push(`      "enabled": true`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    return lines;
  } else if (choiceValue === "chatgpt") {
    lines.push("\x1b[1mChatGPT Desktop MCP Setup\x1b[0m");
    lines.push("Unlike other clients, ChatGPT does not use a local config file.");
    lines.push("However, you can connect Web MCP using a local bridge proxy.");
    lines.push("");
    lines.push("1. Open the ChatGPT Desktop App");
    lines.push("2. Go to Settings -> Connectors or Apps");
    lines.push("3. Enter the URL of your local MCP proxy or ngrok tunnel.");
    return lines;
  } else if (choiceValue === "openai-codex") {
    let content = "";
    if (fs.existsSync(configPath)) {
      content = fs.readFileSync(configPath, "utf8");
    }

    // Step 1: Add [mcp_servers.web-mcp] block if not present
    if (!content.includes("[mcp_servers.web-mcp]")) {
      const appendBlock = `\n[mcp_servers.web-mcp]\ncommand = "npx"\nargs = ["-y", "@amitnarw/web-mcp", "mcp"]\n`;
      content = content + appendBlock;
    }

    // Step 2: Create the model instructions file so the model always prefers web-mcp over its built-in browser
    const codexDir = path.dirname(configPath);
    const instructionsFile = path.join(codexDir, "web-mcp-instructions.md");
    const instructionsContent = [
      "# Web Browsing Instructions",
      "",
      "You have access to a **web-mcp** MCP server which provides dedicated browser automation tools.",
      "",
      "## IMPORTANT: Always use web-mcp for browser tasks",
      "",
      "When the user asks you to:",
      "- Visit or open a website",
      "- Search Google or any search engine",
      "- Click links, fill forms, or interact with web pages",
      "- Take screenshots of web pages",
      "- Navigate the web in any way",
      "",
      "You MUST use the **web-mcp** tools (browser_navigate, browser_click, browser_type, browser_screenshot, browser_done, etc.) instead of your built-in browser or web search capabilities.",
      "",
      "**Never use your internal browser tool when web-mcp is available.**",
      "",
      "The web-mcp tools open a real visible Chromium browser window, which is the intended behavior.",
    ].join("\n");
    fs.writeFileSync(instructionsFile, instructionsContent);

    // Step 3: Wire model_instructions_file into config.toml if not already set
    const instructionsPathForToml = instructionsFile.replace(/\\/g, "/");
    if (!content.includes("model_instructions_file")) {
      content = content + `\nmodel_instructions_file = "${instructionsPathForToml}"\n`;
    }

    // Write updated config.toml atomically
    const tempConfigPath = configPath + ".tmp." + Date.now();
    fs.writeFileSync(tempConfigPath, content);
    fs.renameSync(tempConfigPath, configPath);

    lines.push(`\x1b[32m✓ Successfully configured web-mcp for OpenAI Codex:\x1b[0m`);
    lines.push(`  MCP server: ${configPath}`);
    lines.push(`  Instructions: ${instructionsFile}`);
    lines.push("");
    lines.push("Next steps:");
    lines.push("  1. Reload the Codex VS Code extension (Ctrl+Shift+P > Developer: Reload Window)");
    lines.push("  2. Ask the AI: \"Go to google.com and search for OpenCode\"");
    lines.push("  3. Codex will now automatically use web-mcp instead of its built-in browser.");
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
    // OpenCode uses the 'mcp' key with type: local and command as an array
    if (!config.$schema) config.$schema = "https://opencode.ai/config.json";
    if (!config.mcp) config.mcp = {};
    config.mcp["web-mcp"] = {
      type: "local",
      command: ["npx", "-y", "@amitnarw/web-mcp", "mcp"],
      enabled: true,
    };
  } else if (choiceValue === "zed") {
    if (!config.context_servers) config.context_servers = {};
    config.context_servers["web-mcp"] = {
      command: "npx",
      args: ["-y", "@amitnarw/web-mcp", "mcp"],
    };
  } else {
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers["web-mcp"] = {
      type: "stdio",
      command: "npx",
      args: ["-y", "@amitnarw/web-mcp", "mcp"],
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
