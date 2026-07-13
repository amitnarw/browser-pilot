# Getting started with Web MCP

This guide walks you through your first time using Web MCP.

## Step 1: Install the package

Open a terminal and run:

```bash
npm install -g @amitnarw/web-mcp
```

This installs Web MCP on your computer. During install, a dedicated Chromium browser gets downloaded in the background. This is about 130 MB and takes a minute or so depending on your internet speed.

## Step 2: Run setup

In the same terminal, type:

```bash
web-mcp
```

A menu will appear with several options. Pick **Configure AI Client (Setup)** by pressing the up/down arrow keys and pressing Enter.

A list of AI tools will show up. Pick the one you use (like OpenCode, Cursor, or Claude Code). The setup will create the configuration file your AI needs to talk to Web MCP.

If you want to see the status of your setup later, run:

```bash
web-mcp status
```

## Step 3: Ask your AI

Open your AI tool and ask it to do something in a browser. Here are some examples:

- "Go to google.com and search for OpenCode"
- "Go to wikipedia.org and find the article about Mars"
- "Go to my bank's website and check if I can log in"

The first time you ask, Web MCP will launch a Chromium browser window. You will see the AI moving through the page in real time. A sidebar shows what the AI is doing.

## What happens next

The browser stays open between sessions. If your AI chat ends, the browser will close itself after about 60 seconds of inactivity. This prevents Chrome windows from piling up.

To stop everything manually:

```bash
web-mcp stop
```

## Next steps

- Read use cases for more ideas: [Use cases](use-cases.md)
- See all available browser tools: [Tools reference](tools-reference.md)
- Troubleshoot problems: [Troubleshooting](troubleshooting.md)
