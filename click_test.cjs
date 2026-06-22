const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9222/json', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const googleTarget = targets.find(t => t.type === 'page');
    const ws = new WebSocket(googleTarget.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Page.navigate',
        params: { url: 'chrome://extensions' }
      }));
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 2,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              const manager = document.querySelector('extensions-manager');
              const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
              const toggle = toolbar.shadowRoot.querySelector('#devMode');
              if (!toggle.hasAttribute('checked')) {
                toggle.click();
              }
              return toggle.hasAttribute('checked');
            `,
            returnByValue: true
          }
        }));
      }, 1000);
    });
    ws.on('message', msg => {
      const response = JSON.parse(msg);
      if (response.id === 2) {
        console.log("Toggle result:", response.result);
        process.exit(0);
      }
    });
  });
});
