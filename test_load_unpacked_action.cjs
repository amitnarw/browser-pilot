const puppeteer = require('puppeteer-core');
const path = require('path');

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

        // Intercept file chooser
        const [fileChooser] = await Promise.all([
            extPage.waitForFileChooser(),
            extPage.evaluate(() => {
                const manager = document.querySelector('extensions-manager');
                const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
                toolbar.shadowRoot.querySelector('#loadUnpacked').click();
            })
        ]);

        console.log("File chooser intercepted!");
        
        // Select the extension directory
        await fileChooser.accept([path.resolve('C:/Users/admin/.web-mcp/extension')]);
        
        console.log("Folder selected!");
        
        await new Promise(r => setTimeout(r, 2000));
        
        // Check for error toast or dialog
        const errorMsg = await extPage.evaluate(() => {
            const manager = document.querySelector('extensions-manager');
            const errorPage = manager.shadowRoot.querySelector('extensions-error-page');
            if (errorPage) {
                return "Error Page Visible";
            }
            
            // Check toast manager
            const toast = manager.shadowRoot.querySelector('cr-toast-manager');
            if (toast && toast.isToastOpen) {
                return toast.shadowRoot.textContent;
            }
            
            return "No obvious error";
        });
        
        console.log("Result:", errorMsg);
        
        // Take a screenshot just in case
        await extPage.screenshot({ path: 'd:/amit/browser-pilot/load_error.png' });
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
