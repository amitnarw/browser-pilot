const cp = require('child_process');
const fs = require('fs');

async function runTest() {
  console.log('Starting web-mcp mcp...');
  const p = cp.spawn('node', ['bin/web-mcp.js', 'mcp']);
  
  await new Promise(r => setTimeout(r, 3000));

  console.log('Navigating...');
  const req1 = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: { url: 'https://example.com', taskName: 'Extension Installation Proof', taskSummary: 'Taking a screenshot to prove the extension works' }
    }
  };
  p.stdin.write(JSON.stringify(req1) + '\n');

  await new Promise(r => setTimeout(r, 6000));

  console.log('Taking screenshot...');
  const req2 = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'browser_screenshot',
      arguments: {}
    }
  };
  p.stdin.write(JSON.stringify(req2) + '\n');

  let buffer = '';
  p.stdout.on('data', d => {
    buffer += d.toString();
    try {
      // Split by newline in case multiple JSON RPC responses come
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const res = JSON.parse(line);
        if (res.id === 2 && res.result && res.result.content) {
           const content = res.result.content[0].text;
           const base64 = content.replace('data:image/png;base64,', '');
           fs.writeFileSync('proof.png', base64, 'base64');
           console.log('SUCCESS! Saved proof.png');
           p.kill();
           process.exit(0);
        }
      }
    } catch(e) {}
  });

  await new Promise(r => setTimeout(r, 5000));
  console.log('Timeout waiting for screenshot.');
  p.kill();
  process.exit(1);
}

runTest();
