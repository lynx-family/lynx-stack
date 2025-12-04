# @lynx-js/devtool-mcp-server

> The Lynx DevTool for coding agents.

`@lynx-js/devtool-mcp-server` lets your coding agent (such as Gemini, Claude, Cursor or Copilot)
control and inspect a live Lynx Engine. It acts as a Model-Context-Protocol
(MCP) server, giving your AI coding assistant access to the full power of
Lynx DevTools for reliable automation.

## Requirements

- [Node.js](https://nodejs.org/) v18.19 or a newer [latest maintenance LTS](https://github.com/nodejs/Release#release-schedule) version.
- A device or simulator opened with [Lynx Engine](https://lynxjs.org/) opened and connected.

## Getting started

Add the following config to your MCP client:

```json
{
  "mcpServers": {
    "lynx-devtool": {
      "command": "npx",
      "args": [
        "-y",
        "@lynx-js/devtool-mcp-server@latest"
      ]
    }
  }
}
```

<details>
  <summary>Claude Code</summary>
    Use the Claude Code CLI to add the Lynx DevTool MCP server (<a href="https://docs.anthropic.com/en/docs/claude-code/mcp">guide</a>):

```bash
claude mcp add lynx-devtool npx @lynx-js/devtool-mcp-server@latest
```

</details>

<details>
  <summary>Codex</summary>
  Follow the <a href="https://github.com/openai/codex/blob/main/docs/advanced.md#model-context-protocol-mcp">configure MCP guide</a>
  using the standard config from above. You can also install the Lynx DevTool MCP server using the Codex CLI:

```bash
codex mcp add lynx-devtool -- npx @lynx-js/devtool-mcp-server@latest
```

</details>

<details>
  <summary>Copilot / VS Code</summary>
  Follow the MCP install <a href="https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server">guide</a>,
  with the standard config from above. You can also install the Lynx DevTool MCP server using the VS Code CLI:

```bash
code --add-mcp '{"name":"lynx-devtool","command":"npx","args":["@lynx-js/devtool-mcp-server@latest"]}'
```

</details>

<details>
  <summary>Cursor</summary>

**Click the button to install:**

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=lynx-devtool&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcmVnaXN0cnkiLCJodHRwczovL2JucG0uYnl0ZWQub3JnIiwiQGJ5dGVkLWx5bngvZGV2dG9vbC1tY3Atc2VydmVyQGxhdGVzdCJdfQ==%3D)

**Or install manually:**

Go to `Cursor Settings` -> `MCP` -> `New MCP Server`. Use the config provided above.

</details>

<details>
  <summary>Gemini CLI</summary>
Install the Lynx DevTool MCP server using the Gemini CLI.

**Project wide:**

```bash
gemini mcp add lynx-devtool npx @lynx-js/devtool-mcp-server@latest
```

**Globally:**

```bash
gemini mcp add -s user lynx-devtool npx @lynx-js/devtool-mcp-server@latest
```

Alternatively, follow the <a href="https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#how-to-set-up-your-mcp-server">MCP guide</a> and use the standard config from above.

</details>

## Credits

This project is inspired by [chrome-devtool-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp). Both the implementation and documentation have been adapted and referenced from the original MCP server.
