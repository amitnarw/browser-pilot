const cp = require('child_process');
const fs = require('fs');
const chromeExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const profileDir = 'C:/Users/admin/.web-mcp/chrome-test-node-spawn';
const extDir = 'C:/Users/admin/.web-mcp/extension';

fs.mkdirSync(profileDir, { recursive: true });

const args = [
  '--remote-debugging-port=9222',
  '--user-data-dir=' + profileDir,
  '--load-extension=' + extDir,
  '--no-first-run',
  '--no-default-browser-check'
];

console.log('Spawning with args:', args);

const proc = cp.spawn(chromeExe, args, { detached: true, stdio: 'ignore' });
proc.unref();

console.log('Spawned PID:', proc.pid);
