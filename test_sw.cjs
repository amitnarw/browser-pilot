const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
        const targets = await browser.targets();
        const swTarget = targets.find(t => t.type() === 'service_worker');
        
        if (!swTarget) {
            console.log("NO SERVICE WORKER FOUND");
            process.exit(0);
        }

        const worker = await swTarget.worker();
        if (!worker) {
            console.log("Could not attach to worker");
            process.exit(0);
        }

        worker.on('console', msg => console.log('SW LOG:', msg.text()));
        
        const evalResult = await worker.evaluate(() => {
            return "SW IS ALIVE";
        });
        
        console.log("Eval:", evalResult);
        
        await new Promise(r => setTimeout(r, 2000));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
