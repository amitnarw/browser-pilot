# Web MCP

Web MCP is a foreground AI browser automation tool designed to act as an **In-Browser Copilot**. It allows AI agents (via MCP) to control a live Google Chrome browser on your desktop while providing a beautiful, real-time activity feed and preventing human-AI input collisions.

## Features

- **Zero-Friction Setup**: Delivered as a single NPM package that bundles the Node.js MCP server and a dedicated Chrome Extension.
- **Auto-Injection**: The MCP server automatically launches a dedicated Chrome profile and dynamically injects the Chrome Extension—no manual "Load Unpacked" required by the end user!
- **Visual Feedback**: Features a native Chrome Side Panel with a real-time action feed and an ambient light overlay that activates when the AI takes control.
- **Human-AI Collision Protection**: Web browsers aren't built for two mice. Web MCP uses an advanced CSS DOM-overlay shield to physically block your hardware mouse clicks from disrupting the AI's synthetic DevTools clicks while it's actively working, gracefully dropping the shield exactly when you need to take control back.

## Prerequisites
> [!IMPORTANT]
> **Google Chrome is required** to be installed on your system. Web MCP uses Chrome's remote debugging protocol to control a dedicated browser profile.

## Installation & Setup

Web MCP is published as an NPM package and acts as an MCP (Model Context Protocol) server.

1. **Install Globally**
   ```bash
   npm install -g @amitnarw/web-mcp
   ```

2. **Run the Automated Setup**
   ```bash
   web-mcp setup
   ```
   *This automatically configures your `opencode.json` (or standard MCP client config) to register Web MCP's local tools.*

## Usage

After running setup, using Web MCP is entirely seamless:

1. Open your AI client (e.g., OpenCode).
2. Ask the AI: *"Go to google.com and search for Opencode"*
3. The AI will call the MCP tools. Web MCP will automatically launch Chrome, attach the extension, show the action feed in the side panel, and execute the task!

### CLI Commands

```bash
web-mcp setup    # One-time setup to wire MCP to your client
web-mcp status   # Check if the backend server and Chrome are healthy
web-mcp stop     # Force quit the background server and browser profile
```

## For Developers & AI Agents

### 🔴 Read First: [AGENTS.md](./AGENTS.md)

If you are an AI agent or a developer modifying this codebase, you **must** read `AGENTS.md`. It contains critical operational context, including:
- Why we use CSS overlays instead of headless browsers.
- Process lifecycles, orphan prevention, and locking states.
- The exact timeline of the `data-bp-ai-acting` DOM injection.
- How to reload the Chrome extension after code changes during development.

### Development Commands

```bash
npm install
npm run build       # Compile TypeScript
npm run bundle      # Minify with esbuild
```

## Architecture

- `src/cli/` — User-facing CLI (`setup`, `status`, `stop`).
- `src/mcp/wrapper.ts` — The MCP server exposing browser tools to the AI.
- `src/server/server.ts` — A persistent HTTP/SSE server that acts as the bridge between the stateless MCP protocol and the stateful Chrome Extension.
- `src/extension/` — **(Source)** The Chrome extension source code (content script, service worker, native side panel). Edit files here!
- `extension/` — **(Build Output)** The compiled and minified Chrome extension files distributed via NPM.
- `dist/` — **(Build Output)** Compiled and minified Node.js server files distributed via NPM.

## License
MIT