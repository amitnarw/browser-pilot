const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const extensionDir = path.join(__dirname, "extension");
const profileDir = path.join(CONFIG_DIR, "chrome-profile");
const userExtensionDir = path.join(CONFIG_DIR, "extension");

if (fs.existsSync(userExtensionDir)) fs.rmSync(userExtensionDir, { recursive: true, force: true });
fs.cpSync(extensionDir, userExtensionDir, { recursive: true });

const chromeExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const args = [
  `--remote-debugging-port=9222`,
  `--user-data-dir=${profileDir}`,
  `--load-extension=${userExtensionDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-popup-blocking",
  "--disable-translate",
  "--disable-default-apps",
  "--disable-fre",
  "https://google.com"
];

console.log("Launching Chrome with args:", args);

const proc = spawn(chromeExe, args, {
  stdio: "inherit",
});

proc.on('close', (code) => {
  console.log(`Chrome exited with code ${code}`);
});
