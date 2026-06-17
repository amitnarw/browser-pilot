const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function capture() {
    let client;
    try {
        client = await CDP({ target: 'E9FEFCAE05E8CE1F7D03AD420F63D846' });
        const { Page } = client;
        
        await Page.enable();
        // Wait a bit just in case
        await new Promise(r => setTimeout(r, 1000));
        
        const { data } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('proof.png', Buffer.from(data, 'base64'));
        console.log('Screenshot saved to proof.png');
    } catch (err) {
        console.error(err);
    } finally {
        if (client) {
            await client.close();
        }
    }
}
capture();
