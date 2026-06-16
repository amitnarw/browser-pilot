const cdp = require('chrome-remote-interface');

async function checkSW() {
  try {
    const client = await cdp({ port: 9222, target: (t) => t.type === 'service_worker' });
    const { Runtime } = client;
    await Runtime.enable();
    
    const res = await Runtime.evaluate({
      expression: 'console.log("Checking SW from CDP"); "SW OK"',
      returnByValue: true
    });
    console.log('SW Evaluation Result:', res);
    await client.close();
  } catch (err) {
    console.error('CDP Error:', err);
  }
}

checkSW();
