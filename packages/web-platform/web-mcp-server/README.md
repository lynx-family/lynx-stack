# Lynx Web Platform MCP Server

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Overview

The Lynx Web Platform MCP Server is a powerful tool designed to bridge the gap between AI agents and web applications built with the Lynx framework. By exposing a set of specialized tools through the Model-Context Protocol (MCP), this server empowers AI models to inspect, analyze, and "see" the visual output and structural hierarchy of Lynx pages, just as a human user would.

This server utilizes Puppeteer to render Lynx application bundles in a headless Chrome instance, ensuring that the AI interacts with a high-fidelity representation of the user-facing content.

## Features

- **MCP-Compliant:** Seamlessly integrates with any MCP-compatible AI agent or orchestrator.
- **Headless Browser Rendering:** Uses Puppeteer for accurate, web-standard rendering of Lynx pages.
- **Visual Inspection:** Provides a tool to capture screenshots of the rendered application.
- **Structural Analysis:** Offers a tool to extract the complete element hierarchy of a Lynx page, enabling deep structural understanding.

## Prerequisites

- **Node.js:** Version 20.0.0 or higher.
- **Google Chrome:** The server uses Puppeteer, which requires a compatible Chrome or Chromium browser. The `preinstall` script automatically attempts to download a suitable version.

## Installation

This package is part of the Lynx-Stack monorepo. To install its dependencies, run the following command from the root of the repository:

```bash
pnpm install
```

The `preinstall` hook will automatically trigger the download and installation of a compatible Chromium browser for Puppeteer.

## Usage

To start the server, you can use the binary exposed by this package. It will launch and listen for MCP requests over `stdio`.

```bash
pnpm lynx-web-mcp-tool
```

Once running, the server is ready to receive tool calls from an MCP client.

## Available Tools

The server currently exposes the following tools for AI agents:

### 1. `get_screenshot`

- **Title:** Get Screenshot
- **Description:** Renders a Lynx page in a headless browser and captures a screenshot of the viewport.
- **Input:**
  - `url` (string): The web preview URL of the Lynx page to capture.
- **Output:** An `image/png` content part containing the base64-encoded screenshot.

### 2. `get_element_hierarchy`

- **Title:** Get Element Hierarchy
- **Description:** Renders a Lynx page and extracts its component hierarchy as a JSON object. This allows an AI to understand the structure of the page, including component tags and their attributes. Note that for clarity and focus, style attributes are excluded from the output.
- **Input:**
  - `url` (string): The web preview URL of the Lynx page to inspect.
- **Output:** An `application/json` content part containing a JSON string that represents the element tree.

**Example JSON Output:**

```json
{
  "tag": "page",
  "attributes": {
    "id": "main-page"
  },
  "children": [
    {
      "tag": "view",
      "attributes": {
        "class": "container"
      },
      "children": [
        {
          "tag": "text",
          "attributes": {
            "value": "Hello, World!"
          },
          "children": []
        }
      ]
    }
  ]
}
```

## Contributing

We welcome contributions! Please read the main `CONTRIBUTING.md` file in the root of the repository to get started.

## License

This project is licensed under the **Apache-2.0 License**. See the `LICENSE` file for more details.
