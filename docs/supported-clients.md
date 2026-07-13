# Supported AI clients

Web MCP works with most popular AI coding tools. The setup menu in the CLI can automatically configure your chosen client.

## How to set up

Run this command and pick your AI tool from the list:

```bash
web-mcp
```

Select **Configure AI Client (Setup)** and follow the instructions.

## Supported tools

| Client | How it connects |
|--------|----------------|
| OpenCode | Local MCP command in opencode.json |
| Claude Desktop | mcpServers in claude_desktop_config.json |
| Claude Code (CLI) | mcpServers in ~/.claude.json |
| Cursor | mcpServers in ~/.cursor/mcp.json |
| Windsurf | mcpServers in mcp_config.json |
| Zed Editor | context_servers in settings.json |
| Sourcegraph Cody | mcpServers in VS Code settings |
| OpenAI Codex | TOML block in ~/.codex/config.toml |
| ChatGPT Desktop | Manual setup (instructions shown in CLI) |
| Cline | mcpServers in cline_mcp_settings.json |
| Antigravity IDE | mcpServers in mcp_config.json |

## What setup does

For each client, setup creates or updates a config file so the client knows how to start Web MCP. The config tells the client to run `web-mcp` as a command and connect to it.

After setup, just restart your AI client and it should see Web MCP as an available tool.
