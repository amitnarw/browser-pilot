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

        const text = await extPage.evaluate(() => {
            const getShadowText = (root) => {
                let txt = "";
                for (const node of root.childNodes) {
                    if (node.nodeType === 3) txt += node.nodeValue + "\n";
                    if (node.nodeType === 1) {
                        if (node.shadowRoot) txt += getShadowText(node.shadowRoot);
                        txt += getShadowText(node);
                    }
                }
                return txt;
            };
            return getShadowText(document.body);
        });

        console.log("DUMP:\n", text.trim());
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
