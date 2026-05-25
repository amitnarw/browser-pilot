const WebSocket = require('ws');

async function checkSidebar() {
  const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/E5CEAA3ADDF9692A4A7B1149A63C7896');
  
  ws.on('open', () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: 'document.getElementById("browser-pilot-sidebar") !== null'
      }
    }));
    
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: 'document.getElementById("browser-pilot-overlay") !== null'
      }
    }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id === 1) {
      console.log('Sidebar exists:', msg.result?.result?.value);
    }
    if (msg.id === 2) {
      console.log('Overlay exists:', msg.result?.result?.value);
      ws.close();
      process.exit(0);
    }
  });
  
  setTimeout(() => {
    console.log('Timeout');
    ws.close();
    process.exit(1);
  }, 5000);
}

checkSidebar().catch(console.error);