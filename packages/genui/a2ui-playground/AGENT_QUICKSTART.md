# A2UI Playground Agent Quickstart

Goal: start `a2ui-playground` locally and use a real Claude Code-backed Agent in `AI Chat` instead of the mock flow.

## Prerequisites

1. `pnpm` is installed
2. `Claude Code CLI` is installed
3. `Claude Code` is already logged in
4. Workspace dependencies have already been installed from the repository root

## 1. Enter the Repository

```bash
cd /Users/bytedance/Desktop/lynx/lynx-stack
```

## 2. Verify Claude Code Availability

Run this first:

```bash
pnpm -C packages/genui/a2ui-playground check:agent
```

Expected output includes both:

1. `claude auth status` showing:

```json
{
  "loggedIn": true
}
```

2. `claude --version` showing something like:

```text
2.x.x (Claude Code)
```

If this fails:

- Not logged in: run `claude auth login --claudeai`
- Command not found: install `Claude Code CLI` first

## 3. Start Playground + Agent

Run:

```bash
pnpm -C packages/genui/a2ui-playground dev:agent
```

This command does three things:

1. Checks Claude Code auth and CLI availability
2. Builds the Lynx preview bundle
3. Starts the web dev server with built-in `__agent/*` routes

## 4. Open the App

After startup, the terminal prints something like:

```text
Local:
- index http://localhost:3001/
```

Open that URL in your browser.

## 5. Verify Real AI Chat

On the `AI Chat` page, confirm:

1. The header shows `Ready (claude_code)`
2. The input is enabled
3. Send:

```text
Reply with exactly: ok
```

Expected behavior:

1. Status changes to `Streaming`
2. Your user message appears in the chat list
3. The assistant streams back:

```text
ok
```

If this works, the real Agent text flow is connected.

## 6. Verify Preview Rendering

Send this prompt:

```text
Return only a json fenced code block. The JSON must be an object with a messages array for A2UI. Use exactly this payload:
{"messages":[{"createSurface":{"surfaceId":"surface1","catalogId":"inline-text"}},{"updateComponents":{"surfaceId":"surface1","components":[{"id":"root","component":"Text","text":"Hello from A2UI"}]}}]}
```

Expected behavior:

1. The chat panel shows Claude's JSON code block
2. The `Lynx Preview` panel switches from placeholder to a real preview
3. The rendered preview shows `Hello from A2UI`

If the QR code does not appear, the render URL is probably too long. That does not affect the iframe preview itself.

## Common Commands

### Start

```bash
pnpm -C packages/genui/a2ui-playground dev:agent
```

### Check Agent

```bash
pnpm -C packages/genui/a2ui-playground check:agent
```

### Start on a Specific Port

```bash
pnpm -C packages/genui/a2ui-playground dev:agent --port 3309
```

## Troubleshooting

### 1. `check:agent` fails

Do this:

- Run `claude auth login --claudeai`
- Run `check:agent` again

### 2. The page opens, but AI Chat shows `Unavailable`

Do this:

- Run `check:agent`
- Check the startup terminal for `__agent` route errors

### 3. AI Chat returns text, but the right preview does not update

This usually means:

- The real Agent pipeline is working
- The model did not return valid A2UI JSON for that message

Do this:

- Retry with the A2UI prompt template above

## Short Version

The shortest path is:

```bash
pnpm -C packages/genui/a2ui-playground check:agent
pnpm -C packages/genui/a2ui-playground dev:agent
```

Then open the local URL printed in the terminal and go to `AI Chat`.
