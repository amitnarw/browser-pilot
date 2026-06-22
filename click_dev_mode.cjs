const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9222/json', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const extTarget = targets.find(t => t.url === 'chrome://extensions/');
    if (!extTarget) return console.log('Target not found');
    const ws = new WebSocket(extTarget.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: 'document.querySelector("extensions-manager").shadowRoot.querySelector("extensions-toolbar").shadowRoot.querySelector("#devMode").click()'
        }
      }));
      setTimeout(() => process.exit(0), 1000);
    });
  });
});
