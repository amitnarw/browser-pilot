const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const pages = await browser.pages();
        const page = pages.find(p => p.url().includes('example.com'));
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

        await page.reload({ waitUntil: 'networkidle0' });
        
        console.log('Reload complete');
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
})();
