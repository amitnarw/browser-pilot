#!/usr/bin/env node

(async function() {
  const command = process.argv[2];

  if (!command) {
    const interactive = await import("../dist/cli/interactive.min.js");
    await interactive.run();
  } else {
    switch (command) {
      case "mcp":
        await import("../dist/mcp/wrapper.min.js");
        break;
      case "setup": {
        const interactive = await import("../dist/cli/interactive.min.js");
        await interactive.run();
        break;
      }
      case "stop": {
        const stop = await import("../dist/cli/stop.min.js");
        const lines = await stop.stopProcesses();
        console.log(lines.join("\n"));
        break;
      }
      case "status": {
        const status = await import("../dist/cli/status.min.js");
        const lines = await status.getStatus();
        console.log(lines.join("\n"));
        break;
      }
      case "-v":
      case "--version": {
        const fs = await import("fs");
        const path = await import("path");
        const { fileURLToPath } = await import("url");
        const __filename = fileURLToPath(import.meta.url);
        const pkgPath = path.join(path.dirname(__filename), "..", "package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        console.log("Web MCP v" + pkg.version);
        break;
      }
      default:
        console.log("");
        console.log("\x1b[1mWeb MCP - In-Browser Copilot\x1b[0m");
        console.log("");
        console.log("Usage:");
        console.log("  web-mcp          Open the interactive dashboard");
        console.log("  web-mcp mcp      Run MCP server (used automatically by AI clients)");
        console.log("  web-mcp setup    Configure AI Client (Setup) or Uninstall");
        console.log("  web-mcp test     Test Setup & Configurations");
        console.log("  web-mcp status   Check Server & Chrome Status");
        console.log("  web-mcp stop     Stop Server & Chrome");
        console.log("  web-mcp help     Show this help menu");
        console.log("  web-mcp about    About Web MCP");
        console.log("");
        if (command === "about") {
          console.log("Web MCP is an advanced browser automation tool designed for AI assistants.");
          console.log("It uses a local server and a dedicated Chrome extension to provide a");
          console.log("collision-free, visually stunning browser automation experience.");
          console.log("");
        }
    }
  }
})();
