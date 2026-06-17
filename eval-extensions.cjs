const WebSocket = require('ws');
const ws = new WebSocket('');
ws.on('open', () => {
    ws.send(JSON.stringify({ 
        id: 1, 
        method: 'Runtime.evaluate', 
        params: { expression: 'document.body.innerText' } 
    }));
});
ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id === 1) {
        console.log(msg.result.result.value);
        process.exit(0);
    }
});
setTimeout(() => process.exit(0), 5000);
