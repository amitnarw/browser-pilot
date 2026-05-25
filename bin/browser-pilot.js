#!/usr/bin/env node

(async function() {
  var command = process.argv[2];

  switch (command) {
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
      console.log("BrowserPilot - AI browser automation sidebar");
      console.log("");
      console.log("Usage:");
      console.log("  browser-pilot setup    One-time setup");
      console.log("  browser-pilot stop     Stop server + Chrome");
      console.log("  browser-pilot status   Check status");
      console.log("");
      console.log("After setup, just run: opencode");
      console.log("");
  }
})();
