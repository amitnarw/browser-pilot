const cp = require('child_process');
const fs = require('fs');

async function test() {
  const profileDir = 'C:/Users/admin/.web-mcp/chrome-test-clean-5';
  if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  const extDir = 'C:/Users/admin/.web-mcp/extension';
  
  const args = [
    '--remote-debugging-port=9222',
    '--user-data-dir=' + profileDir,
    '--load-extension=' + extDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    '--disable-translate',
    '--disable-default-apps',
    '--disable-fre'
  ];

  console.log('Launching Chrome with all flags...');
  const p = cp.spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args, { detached: true, stdio: 'ignore' });
  p.unref();
}
test();
