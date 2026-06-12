import { Orb } from "./orb.js";

const options = [
  { value: "setup", label: "Configure AI Client (Setup)" },
  { value: "status", label: "Check Server & Chrome Status" },
  { value: "stop", label: "Stop Server & Chrome" },
  { value: "exit", label: "Exit" }
];

export async function run() {
  console.clear();
  const orb = new Orb();
  
  let selectedIndex = 0;
  let time = 0;
  let linesRendered = 0;
  
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise<void>((resolve) => {
    const onData = async (key: string) => {
      // Ctrl+C or Esc
      if (key === "\u0003" || key === "\u001b") {
        cleanup();
        process.exit(0);
      }
      // Up arrow
      if (key === "\u001b[A") {
        selectedIndex = Math.max(0, selectedIndex - 1);
      }
      // Down arrow
      if (key === "\u001b[B") {
        selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
      }
      // Enter
      if (key === "\r" || key === "\n") {
        cleanup();
        await handleSelection(options[selectedIndex].value);
        resolve();
      }
    };
    
    process.stdin.on("data", onData);

    const renderLoop = setInterval(() => {
      if (linesRendered > 0) {
        process.stdout.write(`\x1b[${linesRendered}A\x1b[1G`);
      }
      
      process.stdout.write("\x1b[?25l");
      
      let out = "";
      
      out += `\x1b[1mWeb MCP\x1b[0m\x1b[K\n`;
      out += `\x1b[90mIn-Browser Copilot\x1b[0m\x1b[K\n`;
      out += `\x1b[K\n`;
      
      const orbFrames = orb.render(time);
      for (let i = 0; i < orbFrames.length; i++) {
        out += `${orbFrames[i]}\x1b[K\n`;
      }
      
      out += `\x1b[K\n`;
      out += `\x1b[1mWhat would you like to do?\x1b[0m\x1b[K\n`;
      out += `\x1b[90mUse arrow keys to navigate. Press Enter to select.\x1b[0m\x1b[K\n`;
      
      for (let i = 0; i < options.length; i++) {
        const isSelected = i === selectedIndex;
        if (isSelected) {
          out += `> \x1b[36m${i + 1}. ${options[i].label} ✓\x1b[0m\x1b[K\n`;
        } else {
          out += `  ${i + 1}. ${options[i].label}\x1b[K\n`;
        }
      }
      
      process.stdout.write(out);
      linesRendered = out.split("\n").length - 1;
      
      time += 0.1;
    }, 50);

    function cleanup() {
      clearInterval(renderLoop);
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\x1b[?25h\n");
      console.clear();
    }
  });
}

async function handleSelection(value: string) {
  if (value === "setup") {
    const setup = await import("./setup.js");
    await setup.run();
  } else if (value === "status") {
    const status = await import("./status.js");
    await status.run();
  } else if (value === "stop") {
    const stop = await import("./stop.js");
    await stop.run();
  } else if (value === "exit") {
    process.exit(0);
  }
}
