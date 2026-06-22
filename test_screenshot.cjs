const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const page = await browser.newPage();
        
        await page.goto('chrome://extensions/');
        await new Promise(r => setTimeout(r, 2000));
        
        await page.screenshot({ path: 'd:/amit/browser-pilot/extensions_screenshot.png' });
        console.log("Screenshot saved!");
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
