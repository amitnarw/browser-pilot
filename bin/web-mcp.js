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
      default:
        console.log("");
        console.log("Web MCP - AI browser automation sidebar");
        console.log("");
        console.log("Usage:");
        console.log("  web-mcp          Open interactive dashboard");
        console.log("  web-mcp mcp      Run MCP server (used by AI clients)");
        console.log("  web-mcp setup    One-time setup");
        console.log("  web-mcp stop     Stop server + Chrome");
        console.log("  web-mcp status   Check status");
        console.log("");
    }
  }
})();
