const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const page = await browser.newPage();
        await page.goto('chrome://policy');
        await new Promise(r => setTimeout(r, 2000));
        
        const policies = await page.evaluate(() => {
            const rows = document.querySelectorAll('.policy-data');
            return Array.from(rows).map(r => r.innerText).join('\n');
        });
        
        console.log("POLICIES:\n", policies);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
