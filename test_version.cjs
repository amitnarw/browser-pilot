const puppeteer = require('puppeteer-core');
(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const page = await browser.newPage();
        await page.goto('chrome://version/');
        await new Promise(r => setTimeout(r, 1000));
        
        const text = await page.evaluate(() => document.body.innerText);
        console.log('VERSION PAGE:', text.substring(0, 1000));
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
})();
