# Troubleshooting

Here are common issues and how to fix them.

## The browser does not open

If you ask your AI to do something and nothing happens, try these:

1. Make sure the installation finished fully. Run `web-mcp status` to check.
2. Run the built-in troubleshoot command:
   ```bash
   web-mcp troubleshoot
   ```
   This will check if the browser is installed, if the server is running, and if the configuration is correct.
3. Check if anything is already running on port 3026. Another program might be using it.

## The AI says it cannot reach Web MCP

This usually means the configuration file was not created or is wrong.

1. Run `web-mcp` and select **Configure AI Client (Setup)**.
2. Pick your AI tool from the list.
3. Restart your AI client.

If that does not work, run the troubleshoot command:
```bash
web-mcp troubleshoot
```

## The browser window shows but nothing happens

1. Check the side panel in the Chromium window. It should show what the AI is doing.
2. If the side panel is blank, try reloading the extension:
   - Go to `chrome://extensions` in the Chromium window.
   - Find **Web MCP** and click the reload icon.
   - Refresh the page.

## Multiple browser windows keep opening

This is normal for the first run. Web MCP manages its own browser session. If windows are piling up, run:

```bash
web-mcp stop
```

This closes everything cleanly.

## Error about Chromium not found

The Chromium download might not have completed. Run the troubleshoot command to reinstall:

```bash
web-mcp troubleshoot
```

If that does not work, try reinstalling:

```bash
npm install -g @amitnarw/web-mcp
```

## For more help

Check the server logs:

```bash
Invoke-RestMethod "http://localhost:3026/logs" | ConvertTo-Json -Depth 2
```

Or contact us at amitnarwal115@gmail.com.
