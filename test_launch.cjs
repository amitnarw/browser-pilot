const { spawn } = require('child_process');
const http = require('http');

const profileDir = "C:/Users/admin/.web-mcp/chrome-profile-v2";
const extensionDir = "C:/Users/admin/.web-mcp/extension";

const args = [
  "--remote-debugging-port=9222",
  `--user-data-dir=${profileDir}`,
  `--disable-extensions-except=${extensionDir}`,
  `--load-extension=${extensionDir}`,
  "--enable-automation",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-popup-blocking",
  "--disable-translate",
  "--disable-default-apps",
  "--disable-fre"
];

const proc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", args, {
  detached: true,
  stdio: "ignore"
});

console.log("Launched Chrome with PID:", proc.pid);

setTimeout(() => {
  http.get("http://127.0.0.1:9222/json", (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log("TARGETS:");
      const targets = JSON.parse(data);
      console.log(targets.map(t => t.url));
      proc.kill();
      process.exit(0);
    });
  }).on('error', (err) => {
    console.error("Fetch failed:", err.message);
    proc.kill();
    process.exit(1);
  });
}, 3000);
