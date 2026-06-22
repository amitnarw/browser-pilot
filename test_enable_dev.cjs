const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222'
        });
        const pages = await browser.pages();
        let extPage = pages.find(p => p.url().includes('chrome://extensions'));
        
        await extPage.evaluate(() => {
            const manager = document.querySelector('extensions-manager');
            const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
            const toggle = toolbar.shadowRoot.querySelector('#devMode');
            if (!toolbar.inDevMode) {
                toggle.click();
            }
        });

        console.log("Clicked Developer Mode toggle");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
