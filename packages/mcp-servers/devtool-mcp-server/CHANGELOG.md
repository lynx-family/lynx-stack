# @lynx-js/devtool-mcp-server

## 0.5.0

### Minor Changes

- Use `@lynx-js/devtool-connector` instead of `@lynx-js/debug-router-connector`. ([#2284](https://github.com/lynx-family/lynx-stack/pull/2284))

  The new connector avoids using keep-alive connections, which makes the connection much more reliable.

- **BREAKING CHANGE**: Remove the `./debug-router-connector` exports. ([#2284](https://github.com/lynx-family/lynx-stack/pull/2284))

## 0.4.1

### Patch Changes

- Export `registerTool` and `defineTool`. ([#1931](https://github.com/lynx-family/lynx-stack/pull/1931))

- Fix failed to connect to client. ([#1931](https://github.com/lynx-family/lynx-stack/pull/1931))
