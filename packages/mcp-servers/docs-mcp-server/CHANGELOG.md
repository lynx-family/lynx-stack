# @lynx-js/docs-mcp-server

## 0.2.6

### Patch Changes

- Update `@modelcontextprotocol/sdk` from `1.25.2` to `1.28.0` ([#3213](https://github.com/lynx-family/lynx-stack/pull/3213))

- Update `undici` from `^6.27.0` to `^6.28.0` ([#3326](https://github.com/lynx-family/lynx-stack/pull/3326))

- Update `commander` from `^13.1.0` to `^15.0.0` ([#3340](https://github.com/lynx-family/lynx-stack/pull/3340))

- Update `undici` from `^6.28.0` to `^8.10.0` ([#3342](https://github.com/lynx-family/lynx-stack/pull/3342))

## 0.2.5

### Patch Changes

- Pin `@modelcontextprotocol/sdk` to 1.25.2. 1.29.0 added a `types` condition to ([#3220](https://github.com/lynx-family/lynx-stack/pull/3220))
  its `./*` export wildcard, which resolves `server/mcp.js` to
  `dist/esm/server/mcp.js.d.ts` — a file that does not exist, the real one being
  `mcp.d.ts`. A caret range let any lockfile regeneration pull it in.

- Update `undici` from `^6.23.0` to `^6.27.0` ([#3217](https://github.com/lynx-family/lynx-stack/pull/3217))

- Update `empathic` from `^2.0.0` to `^2.0.1` ([#3086](https://github.com/lynx-family/lynx-stack/pull/3086))

- Update `mdast-util-from-markdown` from `^2.0.2` to `^2.0.3` ([#3087](https://github.com/lynx-family/lynx-stack/pull/3087))

## 0.2.4

### Patch Changes

- Add a disabled `dummyTool` so Codex can discover tool support during MCP startup without exposing any real tools. ([#2919](https://github.com/lynx-family/lynx-stack/pull/2919))

## 0.2.3

### Patch Changes

- fix(docs-mcp): recursively crawl and register nested llms.txt resources ([#2317](https://github.com/lynx-family/lynx-stack/pull/2317))

## 0.2.2

### Patch Changes

- Fix Windows startup error. ([#2474](https://github.com/lynx-family/lynx-stack/pull/2474))
