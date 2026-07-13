# Tools reference

When your AI uses Web MCP, it can call these tools to control the browser.

## Navigation

| Tool | What it does |
|------|-------------|
| browser_navigate | Go to a web address |
| browser_get_tabs | Show all open tabs |
| browser_switch_tab | Switch to a different tab |
| browser_new_tab | Open a new tab |
| browser_close_tab | Close the current tab |
| browser_get_url | Get the web address of the current page |

## Interacting with pages

| Tool | What it does |
|------|-------------|
| browser_click | Click on an element on the page |
| browser_type | Type text into a focused input field |
| browser_fill | Fill a specific input field with text |
| browser_press_key | Press a keyboard key (Enter, Escape, etc.) |
| browser_hover | Hover the mouse over an element |
| browser_scroll | Scroll the page up or down |
| browser_drag | Drag an element to another location |

## Reading the page

| Tool | What it does |
|------|-------------|
| browser_snapshot | Get a simplified view of the page layout and content |
| browser_screenshot | Take a screenshot of the current view |
| browser_evaluate | Run JavaScript code on the page |

## Session control

| Tool | What it does |
|------|-------------|
| browser_done | Tell Web MCP you are finished, unlocks the screen |
| browser_get_status | Check if the browser is active or idle |
| browser_wait | Wait for something to appear on the page or wait a set time |
| browser_stop | Close the browser and end the session |

## Notes

- The AI calls these tools automatically when you give it a task. You do not need to remember them.
- Some tools need an element ID or selector. The AI gets this from the page snapshot.
- Screenshots are taken only when requested and are not stored anywhere.
