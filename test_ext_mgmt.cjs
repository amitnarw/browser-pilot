const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const page = await browser.newPage();
        await page.goto('chrome://extensions/');
        await new Promise(r => setTimeout(r, 1000));
        
        const extList = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.management.getAll(exts => {
                    resolve(exts.map(e => e.name + " (" + e.installType + ")"));
                });
            });
        });
        
        console.log('CHROME MANAGEMENT EXTS:', extList);
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
})();
