# Vue Lynx — Agent Guidelines

## Debugging Checklist

When investigating runtime errors in Lynx bundles:

1. **Clear caches first** — Before doing any code analysis, always:
   - `rm -rf node_modules/.cache` in the example/app directory
   - Restart the dev server (`pnpm dev`)
   - Restart LynxExplorer (stale error toasts persist across navigations)

   rspeedy-plugin is built separately from example apps. After rebuilding the plugin, the webpack persistent cache in example apps still serves stale bundles. This is the #1 cause of "phantom" errors that don't reproduce after a clean rebuild.

2. **Verify hash matching** — For worklet-related errors (`TypeError: cannot read property 'bind' of undefined`), check that BG `_wkltId` hashes match MT `registerWorkletInternal` hashes. Inspect the `.web.bundle` (JSON format) to compare.

3. **Check LynxExplorer state** — The error toast is persistent across page navigations. A stale error from a previous page load can be mistaken for a current error. Restart the simulator app to clear.

## Architecture Notes

### Dual-Thread Build (rspeedy-plugin)

- **Background Thread**: Vue runtime + user app. Layer: `vue:background`.
- **Main Thread**: PAPI bootstrap + worklet registrations. Layer: `vue:main-thread`.
- Both layers import the same user code; webpack `issuerLayer` routes files to different loaders.
- BG: `worklet-loader` (SWC JS pass) — replaces `'main thread'` functions with context objects.
- MT: `worklet-loader-mt` (SWC LEPUS pass) — extracts `registerWorkletInternal()` calls.

### Key Files

| File                                              | Purpose                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `rspeedy-plugin/src/entry.ts`                     | Dual-bundle entry splitting, loader rules, webpack plugins        |
| `rspeedy-plugin/src/index.ts`                     | `pluginVueLynx()` — Vue SFC + Lynx adaptation                     |
| `rspeedy-plugin/src/loaders/worklet-loader.ts`    | BG worklet transform (JS target)                                  |
| `rspeedy-plugin/src/loaders/worklet-loader-mt.ts` | MT worklet transform (LEPUS target)                               |
| `rspeedy-plugin/src/loaders/worklet-utils.ts`     | Shared: `extractLocalImports`, `extractRegistrations`             |
| `main-thread/src/entry-main.ts`                   | MT bootstrap: renderPage, vuePatchUpdate, worklet-runtime loading |
| `main-thread/src/ops-apply.ts`                    | MT ops interpreter: switch loop over flat ops array               |
| `runtime/src/index.ts`                            | BG custom renderer: createApp, ShadowElement tree, ops buffer     |

### Common Gotchas

- `worklet-loader-mt` must emit `export default {};` for vue script sub-modules (`?vue&type=script`) to satisfy the `experimentalInlineMatchResource` proxy re-export.
- Bootstrap packages (`@lynx-js/vue-main-thread`, `@lynx-js/vue-internal`) must be excluded from MT loaders — in pnpm workspaces they resolve via symlinks (not under `node_modules/`), so `/node_modules/` exclude alone is insufficient.
- `VueMarkMainThreadPlugin` must add `RuntimeGlobals.startup` for MT entry chunks — without it, `chunkLoading: 'lynx'` prevents module factory execution.
