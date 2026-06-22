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

        // Wait for elements to load
        await new Promise(r => setTimeout(r, 1000));

        // We need to dig into the shadow DOM of chrome://extensions
        const errorText = await extPage.evaluate(() => {
            const manager = document.querySelector('extensions-manager');
            if (!manager || !manager.shadowRoot) return "No manager";
            
            const itemList = manager.shadowRoot.querySelector('extensions-item-list');
            if (!itemList || !itemList.shadowRoot) {
                // Check if it's an error popup (manifest error)
                const errorDialog = manager.shadowRoot.querySelector('extensions-error-page');
                if (errorDialog && errorDialog.shadowRoot) {
                   return "MANIFEST_ERROR: " + errorDialog.shadowRoot.textContent;
                }
                
                const crToast = manager.shadowRoot.querySelector('cr-toast');
                if (crToast && crToast.shadowRoot) {
                   return "TOAST_ERROR: " + crToast.textContent;
                }

                return "No item-list. InnerHTML: " + manager.shadowRoot.innerHTML.substring(0, 500);
            }

            const items = itemList.shadowRoot.querySelectorAll('extensions-item');
            for (const item of items) {
                const nameNode = item.shadowRoot.querySelector('#name');
                if (nameNode && nameNode.textContent.includes('web-mcp')) {
                    const errorsBtn = item.shadowRoot.querySelector('#errors-button');
                    if (errorsBtn) {
                        return "HAS_ERRORS_BUTTON";
                    }
                    return "NO_ERRORS_BUTTON_BUT_FOUND";
                }
            }
            
            return "Extension not found in list";
        });

        console.log("Result:", errorText);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
