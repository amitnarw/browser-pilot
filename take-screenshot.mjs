import CDP from 'chrome-remote-interface';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

async function run() {
  const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
  const userExtensionDir = path.join(CONFIG_DIR, "extension");
  const profileDir = path.join(CONFIG_DIR, "chrome-profile-fresh-test-2");
  
  const args = [
    `--remote-debugging-port=9222`,
    `--user-data-dir=C:/Users/admin/.web-mcp/chrome-profile-fresh-test-100`,
    `--load-extension=C:/Users/admin/.web-mcp/extension`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--disable-translate",
    "--disable-default-apps",
    "--disable-fre"
  ];
  
  console.log("Launching Chrome...");
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args, { detached: true, stdio: 'ignore' });
  chrome.unref();

  await new Promise(r => setTimeout(r, 3000));

  let client;
  try {
    client = await CDP({ port: 9222 });
    const { Page, Runtime: r2, Log, Target } = client;
    await Page.enable();
    await Log.enable();
    await r2.enable();
    
    const logs = [];
    Log.entryAdded(({ entry }) => {
      logs.push(entry.text || JSON.stringify(entry));
    });
    r2.consoleAPICalled(({ type, args }) => {
      logs.push(`[CONSOLE ${type}] ${args.map(a => a.value || a.description).join(' ')}`);
    });

    await Page.navigate({ url: 'https://example.com' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 2000));

    // Wait a bit to collect logs
    const { targetInfos } = await Target.getTargets();
    console.log("Targets:", JSON.stringify(targetInfos, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    if (client) {
      await client.close();
    }
    // Kill the chrome we launched
    process.kill(chrome.pid);
    process.exit(0);
  }
}

run();
