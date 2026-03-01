---
applyTo: "packages/repl/**"
---

When generating `LynxTemplate` for REPL preview, ensure main-thread code defines `globalThis.renderPage` (or inject a safe fallback) so the runtime marks main-thread ready and starts `background.js`.
Use `__CreateRawText(...)` appended into `text` nodes for visible text content in Element PAPI examples; setting `value` on `text` is not a reliable default pattern.
Prefer `__FlushElementTree()` with no positional arguments in default snippets unless options are explicitly required.
For web preview in `packages/repl`, place direct Element PAPI rendering (`__CreatePage`, `__CreateElement`, `__FlushElementTree`) in `main-thread.js`; avoid calling these APIs at `background.js` top-level during card load.
Monaco (`monaco-editor`) may emit non-actionable bundler warnings (`Critical dependency` in `editorSimpleWorker` and mocked `__filename`/`__dirname` in `ts.worker`); prefer targeted `rspack.ignoreWarnings` filters in `packages/repl/rsbuild.config.ts` instead of broad warning suppression.
When nesting `LynxPreview` inside `react-resizable-panels`, use `direction` on `ResizablePanelGroup` and preserve `min-h-0`/`h-full` on panel/content containers so `<lynx-view>` does not collapse to zero height.
