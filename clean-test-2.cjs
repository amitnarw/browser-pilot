const cp = require('child_process');
const fs = require('fs');

async function test() {
  const profileDir = 'C:/Users/admin/.web-mcp/chrome-test-clean-2';
  if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  const extDir = 'C:/Users/admin/.web-mcp/extension';
  
  const args = [
    '--remote-debugging-port=9222',
    '--user-data-dir=' + profileDir,
    '--load-extension=' + extDir,
    '--no-first-run',
    '--no-default-browser-check'
  ];

  console.log('Launching Chrome with clean profile...');
  const p = cp.spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args, { detached: true });
  
  await new Promise(r => setTimeout(r, 6000));

  try {
    const res = await fetch('http://127.0.0.1:9222/json');
    const targets = await res.json();
    const sw = targets.find(t => t.type === 'service_worker');
    if (sw) {
      console.log('SUCCESS! Extension loaded on clean profile. SW URL:', sw.url);
    } else {
      console.log('FAIL! Extension did NOT load. Targets:');
      console.log(targets.map(t => t.type + ' ' + t.url).join('\n'));
    }
  } catch (e) {
    console.log('CDP dead', e);
  }

  cp.execSync('taskkill /F /IM chrome.exe /T');
}
test();
