#!/usr/bin/env node

(async function() {
  var command = process.argv[2];

  if (!command) {
    var interactive = await import("../dist/cli/interactive.min.js");
    await interactive.run();
  } else {
    switch (command) {
      case "mcp":
        await import("../dist/mcp/wrapper.min.js");
        break;
      case "setup":
        var setup = await import("../dist/cli/setup.min.js");
        await setup.run();
        break;
      case "stop":
        var stop = await import("../dist/cli/stop.min.js");
        await stop.run();
        break;
      case "status":
        var status = await import("../dist/cli/status.min.js");
        await status.run();
        break;
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
