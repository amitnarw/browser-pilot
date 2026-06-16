const cp = require('child_process');
const http = require('http');

async function runTest() {
  console.log('Starting web-mcp mcp...');
  const p = cp.spawn('node', ['bin/web-mcp.js', 'mcp']);
  
  // Wait a moment for server to start
  await new Promise(r => setTimeout(r, 2000));

  console.log('Sending browser_navigate request to http://example.com...');
  const req = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: { url: 'http://example.com', taskName: 'Integration Test', taskSummary: 'Testing extension' }
    }
  };
  p.stdin.write(JSON.stringify(req) + '\n');

  console.log('Waiting 8 seconds for Chrome and extension to load...');
  await new Promise(r => setTimeout(r, 8000));

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
    
    const sw = targets.find(t => t.type === 'service_worker');
    if (sw) {
      console.log('SUCCESS: Service Worker is active!');
    } else {
      console.log('WARNING: Service Worker is NOT in the target list (might be suspended).');
    }

    // Now test DOM injection
    const req2 = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'evaluate_script',
        arguments: { function: '() => document.getElementById("bp-bar-status") ? "INSTALLED" : "MISSING"' }
      }
    };
    p.stdin.write(JSON.stringify(req2) + '\n');

    let found = false;
    p.stdout.on('data', d => {
       const str = d.toString();
       if (str.includes('INSTALLED')) {
         console.log('SUCCESS: Content script DOM injected successfully! (bp-bar-status found)');
         found = true;
       }
    });

    await new Promise(r => setTimeout(r, 2000));
    
    if (!found) {
       console.log('ERROR: DOM injection failed! Could not find bp-bar-status.');
    } else {
       console.log('TEST PASSED 100%!');
    }

  } catch (err) {
    console.log('Test failed with error:', err);
  }
  
  p.kill();
  process.exit(0);
}

runTest();
