const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');

console.log("Starting web-mcp browser...");
const proc = spawn('node', ['bin/web-mcp.js', 'browser'], {
  stdio: 'ignore',
  detached: true
});
proc.unref();

setTimeout(() => {
  http.get("http://127.0.0.1:9222/json", (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const targets = JSON.parse(data);
      let googleTarget = targets.find(t => t.url.includes("google.com") && t.type === "page");
      if (!googleTarget) {
        googleTarget = targets.find(t => t.type === "page");
      }
      
      if (!googleTarget) {
        console.log("TEST FAILED: No page target found.");
        process.exit(1);
      }
      
      console.log("Connecting to target...");
      const ws = new WebSocket(googleTarget.webSocketDebuggerUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 101, method: 'Runtime.enable' }));
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 3000);
      });
      
      ws.on('message', (msg) => {
        const response = JSON.parse(msg);
        if (response.method === 'Runtime.consoleAPICalled') {
          const args = response.params.args.map(a => a.value || a.description).join(' ');
          console.log(`[CHROME CONSOLE] [${response.params.type}] ${args}`);
        } else if (response.method === 'Runtime.exceptionThrown') {
          console.log(`[CHROME EXCEPTION] ${response.params.exceptionDetails.exception.description}`);
        } else if (response.id === 2) {
          const fs = require('fs');
          fs.writeFileSync('screenshot.png', response.result.data, 'base64');
          console.log("Screenshot saved to screenshot.png");
          process.exit(0);
        }
      });
      
      ws.on('error', (err) => {
        console.log("WebSocket error:", err);
        process.exit(1);
      });
    });
  }).on('error', (err) => {
    console.error("Fetch failed:", err.message);
    process.exit(1);
  });
}, 4000);
