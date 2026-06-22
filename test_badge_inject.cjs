const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const pages = await browser.pages();
        const page = pages.find(p => p.url().includes('example.com'));
        if (!page) { console.log('Page not found'); process.exit(1); }

        const hasBadge = await page.evaluate(() => {
            return !!document.querySelector('.bp-badge');
        });

        console.log('HAS BADGE:', hasBadge);
        
        // Let's also check if content.js threw any errors!
        // We can't retroactively get console logs, but we can check if window.__bp_ai_acting exists or something
        // Wait, content.js adds a div with id 'web-mcp-sidebar'.
        const sidebar = await page.evaluate(() => {
            const sb = document.getElementById('web-mcp-sidebar');
            return sb ? sb.innerHTML.substring(0, 100) : "NOT_FOUND";
        });
        console.log('SIDEBAR:', sidebar);
        
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
})();
