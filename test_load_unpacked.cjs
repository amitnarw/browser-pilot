const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const pages = await browser.pages();
        let extPage = pages.find(p => p.url().includes('chrome://extensions'));
        
        if (!extPage) {
            extPage = await browser.newPage();
            await extPage.goto('chrome://extensions/');
            await new Promise(r => setTimeout(r, 2000));
        }

        const clickResult = await extPage.evaluate(() => {
            const manager = document.querySelector('extensions-manager');
            const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
            const btn = toolbar.shadowRoot.querySelector('#loadUnpacked');
            
            if (!btn) return "Button not found";
            if (btn.disabled) return "Button is DISABLED by Chrome";
            
            return "Button is ENABLED and clickable";
        });

        console.log("Result:", clickResult);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
