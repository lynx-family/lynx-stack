# @lynx-js/docs-mcp-server

> A MCP Server providing Lynx documentation resources for LLMs, with carefully designed prompting.

`@lynx-js/docs-mcp-server` lets your coding agent (such as Gemini, Claude, Cursor or Copilot)
access Lynx documentation to assist you in development tasks. Therefore,
we have specifically optimized [llms.txt](https://lynxjs.org/next/llms.txt),
a condensed version of the documentation site optimized for reading large models.

## Requirements

- [Node.js](https://nodejs.org/) v18.17 or a newer [latest maintenance LTS](https://github.com/nodejs/Release#release-schedule) version.

## Getting started

Add the following config to your MCP client:

```json
{
  "mcpServers": {
    "lynx-docs": {
      "command": "npx",
      "args": [
        "-y",
        "@lynx-js/docs-mcp-server@latest"
      ]
    }
  }
}
```

`@lynx-js/docs-mcp-server` works best with MCP clients that supports [Server Instructions](https://modelcontextprotocol.io/specification/draft/schema#initializeresult), such as Claude Code.
If you find your MCP client don't know about the MCP server,
you can manually provide the following instructions
(e.g. in your `AGENTS.md`, `CLAUDE.md`, or just send it along with your question):

```md
For any questions or requirements regarding Lynx:

1. Use the "List Resources Tool" to list all Resources provided in MCP "lynx-docs".
2. First read MCP Resources "lynx-docs://llms.txt" (**REQUIRED**), this document is an ENTRYPOINT of all Lynx Docs.
3. After reading "lynx-docs://llms.txt", use the "Read MCP Resources Tool" to retrieve docs you need based on the user's questions or requirements, please read them proactively.
4. If available, prioritize obtaining Lynx-related information through MCP Resources tools over external web searches.
```

<details>
  <summary>Claude Code</summary>
    Use the Claude Code CLI to add the Lynx Docs MCP server (<a href="https://docs.anthropic.com/en/docs/claude-code/mcp">guide</a>):

```bash
claude mcp add lynx-docs npx @lynx-js/docs-mcp-server@latest
```

</details>

<details>
  <summary>Codex</summary>
  Follow the <a href="https://github.com/openai/codex/blob/main/docs/advanced.md#model-context-protocol-mcp">configure MCP guide</a>
  using the standard config from above. You can also install the Lynx Docs MCP server using the Codex CLI:

```bash
codex mcp add lynx-docs -- npx @lynx-js/docs-mcp-server@latest
```

</details>

<details>
  <summary>Copilot / VS Code</summary>
  Follow the MCP install <a href="https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server">guide</a>,
  with the standard config from above. You can also install the Lynx Docs MCP server using the VS Code CLI:

```bash
code --add-mcp '{"name":"lynx-docs","command":"npx","args":["@lynx-js/docs-mcp-server@latest"]}'
```

</details>

<details>
  <summary>Cursor</summary>

**Install manually:**

Go to `Cursor Settings` -> `MCP` -> `New MCP Server`. Use the config provided above.

</details>

<details>
  <summary>Gemini CLI</summary>
Install the Lynx Docs MCP server using the Gemini CLI.

**Project wide:**

```bash
gemini mcp add lynx-docs npx @lynx-js/docs-mcp-server@latest
```

**Globally:**

```bash
gemini mcp add -s user lynx-docs npx @lynx-js/docs-mcp-server@latest
```

Alternatively, follow the <a href="https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#how-to-set-up-your-mcp-server">MCP guide</a> and use the standard config from above.

</details>

## Credits

This project is inspired by [Svelte MCP server](https://svelte.dev/docs/mcp/overview). Both the implementation and documentation have been adapted and referenced from the original MCP server.
