const cp = require('child_process');

async function runTest() {
  console.log('Starting web-mcp mcp...');
  const p = cp.spawn('node', ['bin/web-mcp.js', 'mcp']);
  
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

  await new Promise(r => setTimeout(r, 8000));

  console.log('Testing if CSS was injected...');
  const req2 = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'evaluate_script',
      arguments: { function: '() => Array.from(document.querySelectorAll("style")).some(s => s.textContent.includes("bp-spin")) ? "INJECTED" : "NOT_INJECTED"' }
    }
  };
  p.stdin.write(JSON.stringify(req2) + '\n');

  let found = false;
  p.stdout.on('data', d => {
     if (d.toString().includes('INJECTED')) {
       console.log('SUCCESS: Content script CSS injected successfully! The extension IS running on the page.');
       found = true;
     } else if (d.toString().includes('NOT_INJECTED')) {
       console.log('FAILURE: Content script CSS NOT found. The extension is NOT running on the page.');
       found = true;
     }
  });

  await new Promise(r => setTimeout(r, 2000));
  
  if (!found) console.log('ERROR: No response from evaluate_script.');
  
  p.kill();
  process.exit(0);
}

runTest();
