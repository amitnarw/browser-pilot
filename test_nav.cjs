const http = require('http');
const WebSocket = require('ws');

(async () => {
    try {
        const res = await fetch('http://127.0.0.1:9222/json/list');
        const targets = await res.json();
        const page = targets.find(t => t.url.includes('about:blank'));
        if (!page) { console.log('about:blank not found'); process.exit(1); }
        
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
            ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url: 'https://example.com' } }));
        });
        ws.on('message', data => {
            const msg = JSON.parse(data);
            if (msg.method === 'Page.frameNavigated') {
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        id: 3, method: 'Runtime.evaluate', params: { expression: '!!document.querySelector(".bp-badge")', returnByValue: true }
                    }));
                }, 2000);
            }
            if (msg.id === 3) {
                console.log('Badge present:', msg.result.result.value);
                process.exit(0);
            }
        });
    } catch (e) { console.error(e); process.exit(1); }
})();
