import puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectDir = path.join(__dirname, "..");
const extensionDir = path.join(projectDir, "extension");
const assetsDir = path.join(projectDir, "assets");
const serverScript = path.join(projectDir, "dist", "server", "server.min.js");

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Remove ready_badge.png if it exists
try {
  fs.unlinkSync(path.join(assetsDir, "ready_badge.png"));
} catch (e) {}

async function run() {
  console.log("Killing any stale server on port 3026...");
  try {
    if (process.platform === "win32") {
      const { execSync } = await import("child_process");
      const stdout = execSync(`netstat -ano | findstr :3026`).toString();
      const lines = stdout.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid))) {
          console.log(`Killing process ${pid} on port 3026...`);
          execSync(`taskkill /F /PID ${pid}`);
        }
      }
    }
  } catch (e) {}

  console.log("Starting Web MCP server...");
  const serverProc = spawn("node", [serverScript], {
    stdio: "ignore",
    detached: true
  });
  serverProc.unref();

  // Wait for server to start
  await new Promise(r => setTimeout(r, 2000));

  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1340, height: 780 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      "--disable-blink-features=AutomationControlled"
    ]
  });

  try {
    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    console.log("Starting Web MCP Session via HTTP API...");
    // 1. Start session
    await fetch("http://127.0.0.1:3026/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskName: "Go to google.com and search for web-mcp" })
    });

    // 2. Start sidebar
    await fetch("http://127.0.0.1:3026/sidebar/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskName: "Go to google.com and search for web-mcp" })
    });

    // 3. Log action
    await fetch("http://127.0.0.1:3026/sidebar/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Typing search query 'web-mcp'...", type: "type" })
    });

    console.log("Navigating to Google...");
    await page.goto("https://www.google.com");

    // Wait for page load
    await new Promise(r => setTimeout(r, 1500));

    console.log("Locating extension ID...");
    const targets = await browser.targets();
    const extensionTarget = targets.find(t => t.type() === "service_worker");
    if (!extensionTarget) {
      throw new Error("Could not find extension service worker target.");
    }
    const extensionUrl = extensionTarget.url();
    const [, , extensionId] = extensionUrl.split("/");
    console.log(`Extension ID: ${extensionId}`);

    console.log("Injecting native sidebar iframe...");
    const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
    await page.evaluate((url) => {
      const container = document.createElement("div");
      container.id = "mock-sidebar-container";
      container.style.position = "fixed";
      container.style.right = "0";
      container.style.top = "0";
      container.style.width = "360px";
      container.style.height = "100vh";
      container.style.zIndex = "2147483647";
      container.style.borderLeft = "1px solid rgba(255, 255, 255, 0.1)";
      container.style.boxShadow = "-10px 0 30px rgba(0, 0, 0, 0.5)";
      container.style.background = "#131315";
      
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      
      container.appendChild(iframe);
      document.body.appendChild(container);
      
      // Rescale layout to accommodate sidebar
      document.body.style.width = "calc(100vw - 360px)";
      document.body.style.marginRight = "360px";
      document.body.style.boxSizing = "border-box";
    }, sidePanelUrl);

    console.log("Typing query into Google search input...");
    const searchInputSelector = 'input[name="q"], textarea[name="q"]';
    await page.waitForSelector(searchInputSelector, { timeout: 5000 });
    await page.focus(searchInputSelector);
    await page.keyboard.type("web-mcp", { delay: 100 });

    // Wait for layout and animations to settle
    await new Promise(r => setTimeout(r, 2000));

    console.log("Capturing unified page and sidebar screenshot...");
    const screenshotPath = path.join(assetsDir, "demo.png");
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved unified screenshot to ${screenshotPath}`);

  } catch (e) {
    console.error("Error during capture:", e);
  } finally {
    console.log("Cleaning up...");
    await browser.close();
    
    // Kill the server process
    try {
      const { execSync } = await import("child_process");
      if (process.platform === "win32") {
        const stdout = execSync(`netstat -ano | findstr :3026`).toString();
        const lines = stdout.split("\n");
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(parseInt(pid))) {
            execSync(`taskkill /F /PID ${pid}`);
          }
        }
      } else {
        serverProc.kill();
      }
    } catch (e) {}
    
    console.log("Done.");
    process.exit(0);
  }
}

run();
