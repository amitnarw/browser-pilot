const WebSocket = require('ws');
const ws = new WebSocket('');
ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    setTimeout(() => {
        ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: 'console.log("Checking SW logs")' } }));
    }, 500);
});
ws.on('message', (data) => {
    console.log(data.toString());
});
setTimeout(() => process.exit(0), 3000);
