const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const pages = await browser.pages();
        let extPage = pages.find(p => p.url().includes('chrome://extensions'));
        
        if (!extPage) {
            console.log("No extensions page found.");
            process.exit(1);
        }

        const isLoadUnpackedDisabled = await extPage.evaluate(() => {
            const manager = document.querySelector('extensions-manager');
            const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
            const btn = toolbar.shadowRoot.querySelector('#loadUnpacked');
            return btn ? btn.disabled : "Not found";
        });

        console.log("Load Unpacked Disabled:", isLoadUnpackedDisabled);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
