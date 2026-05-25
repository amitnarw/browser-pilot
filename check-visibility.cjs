const WebSocket = require('ws');

async function checkVisibility() {
  const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/E5CEAA3ADDF9692A4A7B1149A63C7896');
  
  ws.on('open', () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          const el = document.getElementById("browser-pilot-sidebar");
          if (el) {
            const rect = el.getBoundingClientRect();
            const styles = window.getComputedStyle(el);
            JSON.stringify({
              exists: true,
              visible: rect.width > 0 && rect.height > 0,
              display: styles.display,
              visibility: styles.visibility,
              opacity: styles.opacity,
              width: rect.width,
              height: rect.height,
              right: rect.right
            });
          } else {
            JSON.stringify({ exists: false });
          }
        `
      }
    }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id === 1) {
      const result = JSON.parse(msg.result?.result?.value || '{}');
      console.log('Sidebar state:', JSON.stringify(result, null, 2));
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

checkVisibility().catch(console.error);
