const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222'
        });
        const pages = await browser.pages();
        let extPage = pages.find(p => p.url().includes('chrome://extensions'));
        
        if (!extPage) {
            console.log("No extensions page found.");
            process.exit(1);
        }

        await new Promise(r => setTimeout(r, 1000));

        const names = await extPage.evaluate(() => {
            const manager = document.querySelector('extensions-manager');
            if (!manager) return ["No manager"];
            const itemList = manager.shadowRoot.querySelector('extensions-item-list');
            if (!itemList) return ["No item-list"];
            const items = itemList.shadowRoot.querySelectorAll('extensions-item');
            let found = [];
            for (const item of items) {
                const nameNode = item.shadowRoot.querySelector('#name');
                if (nameNode) found.push(nameNode.textContent.trim());
            }
            return found;
        });

        console.log("Found extensions:", names);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
