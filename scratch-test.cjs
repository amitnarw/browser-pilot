const cp = require('child_process');
const http = require('http');

async function runTest() {
  console.log('Starting web-mcp mcp...');
  const p = cp.spawn('node', ['bin/web-mcp.js', 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
  
  p.stderr.on('data', d => console.log('[MCP ERR]', d.toString().trim()));
  p.stdout.on('data', d => {
     // Ignore standard MCP stdout to avoid noise, but maybe print it
  });

  console.log('Sending browser_navigate request...');
  const req = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: { url: 'https://example.com', taskName: 'Integration Test', taskSummary: 'Testing extension' }
    }
  };
  p.stdin.write(JSON.stringify(req) + '\n');

  console.log('Waiting 10 seconds for Chrome and extension to load...');
  await new Promise(r => setTimeout(r, 10000));

  console.log('Fetching Chrome targets...');
  try {
    const res = await fetch('http://127.0.0.1:9222/json');
    const targets = await res.json();
    const page = targets.find(t => t.type === 'page' && t.url.includes('example.com'));
    
    if (!page) {
      console.log('ERROR: Chrome did not navigate to example.com!');
      p.kill();
      process.exit(1);
    }

    console.log('Found page target:', page.title);
    
    // Check if the service worker exists
    const sw = targets.find(t => t.type === 'service_worker');
    if (sw) {
      console.log('SUCCESS: Service Worker is active! URL:', sw.url);
    } else {
      console.log('WARNING: Service Worker is NOT in the target list!');
    }

    // Since evaluating JS requires a websocket connection, we can use chrome-remote-interface
    // but instead let's just use simple HTTP to evaluate using the CDP /json/new or similar? No, CDP requires ws.
    // We can use the simple /json endpoint to check if the DOM contains the extension.
    console.log('Using evaluate_script to test DOM injection...');
    
    const req2 = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'evaluate_script',
        arguments: { function: '() => document.getElementById("web-mcp-status-bar") ? "INSTALLED" : "MISSING"' }
      }
    };
    p.stdin.write(JSON.stringify(req2) + '\n');

    // Wait for stdout response
    let found = false;
    p.stdout.on('data', d => {
       const str = d.toString();
       if (str.includes('INSTALLED')) {
         console.log('SUCCESS: Content script DOM injected successfully!');
         found = true;
       }
    });

    await new Promise(r => setTimeout(r, 3000));
    
    if (!found) {
       console.log('ERROR: DOM injection failed!');
    }

    console.log('Test completed.');
  } catch (err) {
    console.log('Test failed with error:', err);
  }
  
  p.kill();
  process.exit(0);
}

runTest();
