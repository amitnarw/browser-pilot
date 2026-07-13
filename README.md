# Web MCP

Web MCP is a tool that lets AI agents control a real web browser on your computer. Think of it like giving your AI assistant the ability to open a browser, go to websites, click buttons, fill out forms, and read what is on the page.

It works with AI tools like OpenCode, Cursor, Claude Code, and many others. When you ask your AI to "go to google.com and search for something", Web MCP opens an actual Chromium browser window and does it right in front of you.

![Web MCP in Action](https://raw.githubusercontent.com/amitnarw/web-mcp/main/assets/demo.png)

---

## What you can do with it

- **Ask your AI to browse the web** — Your AI can navigate to any website, search for things, click on links, and scroll through pages. You can watch it happen in real time.

- **Automate repetitive tasks** — Fill out forms, log in to websites, check dashboards, download reports. Your AI does the clicking and typing for you.

- **Test your website or app** — Ask your AI to go through the checkout flow, check a specific page, or run through common user actions. Useful for quick testing without writing code.

- **Extract information from websites** — Your AI can visit a page, read the content, and summarize it for you. Great for research, price checking, or monitoring.

- **Manage your accounts** — Check your inbox, look at your analytics dashboard, review orders. The AI reads what is on the screen and tells you what you need to know.

- **Run multi-step workflows** — Chain together several browser actions. For example: go to a site, log in, navigate to a report page, download data, and save it. All from one command.

---

## Quick start

### 1. Install

```bash
npm install -g @amitnarw/web-mcp
```

The install will automatically download a dedicated Chromium browser in the background. This takes about a minute.

### 2. Run setup

```bash
web-mcp
```

A menu will appear. Select **Configure AI Client (Setup)** and pick your AI tool from the list. This creates the configuration file your AI needs to talk to Web MCP.

### 3. Ask your AI

Once setup is done, just ask your AI something like:

> "Go to google.com and search for OpenCode"

Web MCP will launch the browser, do the task, and show you what is happening.

---

## Privacy

Everything stays on your machine. Web MCP runs entirely locally:

- The browser opens on your computer, not on some remote server.
- No screenshots, URLs, or browsing data are sent anywhere.
- No analytics, no telemetry, no tracking.
- Your actions and the AI's actions stay private to your session.

We designed it this way from the start. Your data is yours.

---

## Supported AI clients

Web MCP works with these tools: OpenCode, Cursor, Claude Desktop, Claude Code (CLI), Windsurf, Zed Editor, Sourcegraph Cody, OpenAI Codex, ChatGPT Desktop, Cline, and Antigravity IDE.

The setup menu walks you through the configuration for each one.

---

## Full documentation

For detailed guides, use cases, troubleshooting, and a complete list of available tools, check out the docs:

[https://github.com/amitnarw/web-mcp/tree/main/docs](https://github.com/amitnarw/web-mcp/tree/main/docs)

---

## Credits

Built and maintained by Amit Narwal.

- Website: [amitnarwal.com](https://amitnarwal.com)
- Email: amitnarwal115@gmail.com
