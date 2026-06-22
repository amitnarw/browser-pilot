import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      `--disable-extensions-except=C:\\Users\\admin\\.web-mcp\\extension`,
      `--load-extension=C:\\Users\\admin\\.web-mcp\\extension`,
      '--enable-automation'
    ]
  });

  const targets = await browser.targets();
  const extensionTarget = targets.find(t => t.type() === 'background_page' || t.type() === 'service_worker');
  
  if (extensionTarget) {
    console.log("SUCCESS: Extension is loaded!");
    console.log("Extension URL:", extensionTarget.url());
  } else {
    console.log("FAILED: Extension NOT loaded.");
    console.log("Available targets:", targets.map(t => t.url()));
  }

  await browser.close();
})();
