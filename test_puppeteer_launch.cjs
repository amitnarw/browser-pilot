const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    try {
        const profileDir = "C:\\Users\\admin\\.web-mcp\\chrome-profile-puppeteer";
        if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });

        const browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            headless: false,
            userDataDir: profileDir,
            args: [
                '--disable-extensions-except=C:\\Users\\admin\\.web-mcp\\extension',
                '--load-extension=C:\\Users\\admin\\.web-mcp\\extension'
            ]
        });

        const page = await browser.newPage();
        await page.goto('chrome://extensions/');
        await new Promise(r => setTimeout(r, 2000));

        const extList = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.management.getAll(exts => resolve(exts.map(e => e.name)));
            });
        });
        
        console.log('PUPPETEER EXTS:', extList);
        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
