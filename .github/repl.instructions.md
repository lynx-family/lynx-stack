---
applyTo: "packages/repl/**"
---

When generating `LynxTemplate` for REPL preview, ensure main-thread code defines `globalThis.renderPage` (or inject a safe fallback) so the runtime marks main-thread ready and starts `background.js`.
Use `__CreateRawText(...)` appended into `text` nodes for visible text content in Element PAPI examples; setting `value` on `text` is not a reliable default pattern.
Prefer `__FlushElementTree()` with no positional arguments in default snippets unless options are explicitly required.
For web preview in `packages/repl`, place direct Element PAPI rendering (`__CreatePage`, `__CreateElement`, `__FlushElementTree`) in `main-thread.js`; avoid calling these APIs at `background.js` top-level during card load.
Monaco (`monaco-editor`) may emit non-actionable bundler warnings (`Critical dependency` in `editorSimpleWorker` and mocked `__filename`/`__dirname` in `ts.worker`); prefer targeted `rspack.ignoreWarnings` filters in `packages/repl/rsbuild.config.ts` instead of broad warning suppression.
When nesting `LynxPreview` inside `react-resizable-panels`, use `direction` on `ResizablePanelGroup` and preserve `min-h-0`/`h-full` on panel/content containers so `<lynx-view>` does not collapse to zero height.
In `packages/repl`, keep style ownership explicit: `globals.css` should define only theme tokens, document-level base rules (`html/body/#app`), and selectors impossible to express in Tailwind utilities (for example `lynx-view` host rules and `option` styling).
Avoid styling the same visual property through both global class selectors (such as `.repl-header`) and component `className`/`style` at the same time; choose one source of truth per component region.
Avoid `!important` in REPL UI styles unless overriding a third-party stylesheet is unavoidable and documented inline.
Prefer Tailwind utility classes (including CSS variable-backed arbitrary values) for static component presentation; reserve React `style` props for truly dynamic runtime values (for example computed colors or `display` toggles from state).
When using shadcn primitives (`Button`, `Separator`), avoid passing large override class blocks that replace most variant tokens; if a REPL-specific look is needed in many places, add a dedicated variant instead of per-call overrides.
