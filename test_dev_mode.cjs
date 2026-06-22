const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222'
        });
        const pages = await browser.pages();
        let extPage = pages.find(p => p.url().includes('chrome://extensions'));
        
        const devMode = await extPage.evaluate(() => {
            const manager = document.querySelector('extensions-manager');
            if (!manager) return "No manager";
            const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
            if (!toolbar) return "No toolbar";
            return toolbar.inDevMode;
        });

        console.log("Developer Mode:", devMode);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
