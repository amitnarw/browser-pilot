const { spawn } = require('child_process');

const child = spawn('node', ['C:\\nvm4w\\nodejs\\node_modules\\@amitnarw\\web-mcp\\bin\\web-mcp.js', 'mcp'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

child.stdout.on('data', (data) => {
  console.log('RECV:', data.toString());
});

const initReq = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } }
};

const callReq = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "browser_navigate",
    arguments: { url: "https://example.com" }
  }
};

child.stdin.write(JSON.stringify(initReq) + '\n');

setTimeout(() => {
  child.stdin.write(JSON.stringify(callReq) + '\n');
}, 1000);

setTimeout(() => {
  child.kill();
  process.exit(0);
}, 5000);
