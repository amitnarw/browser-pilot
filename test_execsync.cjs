const { execSync } = require('child_process');

try {
  execSync(`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\Users\\admin\\.web-mcp\\chrome-profile-v2" --load-extension="C:\\Users\\admin\\.web-mcp\\extension" --disable-extensions-except="C:\\Users\\admin\\.web-mcp\\extension" --no-first-run`, { stdio: 'inherit' });
} catch (e) {
  console.error("Chrome exited", e);
}
