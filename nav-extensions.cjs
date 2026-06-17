const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/00E8F8576E15F431D8DA651051019A69');
ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'chrome://extensions/' } }));
    setTimeout(() => process.exit(0), 1000);
});
