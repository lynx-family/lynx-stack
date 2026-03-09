# Plan 07: Web Environment Support

## Goal

Enable `environments: { web: {}, lynx: {} }` in Vue Lynx projects so that
`rspeedy dev` produces both `*.lynx.bundle` (native) and `*.web.bundle` (browser
preview), matching the React Lynx plugin's web environment support.

## Background

The React plugin (`@lynx-js/plugin-react`) already supports the `web` environment
by detecting `isWeb` alongside `isLynx` and applying `WebEncodePlugin` (from
`@lynx-js/template-webpack-plugin`) instead of `LynxEncodePlugin`. The rspeedy
core handles all web-specific plumbing (target setting, HMR, web preview
middleware at `/__web_preview`).

The Vue plugin (`@lynx-js/vue-rsbuild-plugin`) currently returns early or skips
processing for any non-lynx environment, meaning `environments: { web: {} }`
produces empty/broken output.

## Reference: React Plugin Entry Handling

File: `packages/rspeedy/plugin-react/src/entry.ts`

```
isLynx  → RuntimeWrapperWebpackPlugin + LynxEncodePlugin
isWeb   → WebEncodePlugin
both    → LynxTemplatePlugin (packages main-thread + background into *.bundle)
neither → skip
```

The `intermediate` directory is `.rspeedy` for lynx, empty string for web (web
entries are not deleted by the template plugin).

## Changes

All changes are in **one file**: `packages/vue/rspeedy-plugin/src/entry.ts`,
plus a config update in the e2e app.

### Step 1: Import `WebEncodePlugin`

```ts
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
  WebEncodePlugin, // ← add
} from '@lynx-js/template-webpack-plugin';
```

Add a plugin name constant:

```ts
const PLUGIN_WEB_ENCODE = 'lynx:vue-web-encode';
```

### Step 2: Add `isWeb` detection to the CSS and worklet-loader callbacks

The first two `modifyBundlerChain` callbacks (CSS ignore-loader and worklet-loader)
currently have `if (!isLynx) return;` guards. Both need to also run for web
environments because:

- CSS ignore-loader: the main-thread layer exists in web too; without it
  VueLoaderPlugin's cloned CSS rules would error for the MT layer.
- Worklet loader: MTS `'main thread'` directive functions still need SWC
  transform for web bundles.

Change:

```ts
if (!isLynx) return;
```

to:

```ts
const isWeb = environment.name === 'web'
  || environment.name.startsWith('web-');
if (!isLynx && !isWeb) return;
```

(The `isLynx` variable is already defined in each callback.)

### Step 3: Add `isWeb` detection in the main entry-splitting callback

In the third `modifyBundlerChain` callback (line ~266), add `isWeb` after the
existing `isLynx`:

```ts
const isWeb = environment.name === 'web'
  || environment.name.startsWith('web-');
```

### Step 4: Apply `LynxTemplatePlugin` for both lynx and web

Change the guard from:

```ts
if (isLynx) {
```

to:

```ts
if (isLynx || isWeb) {
```

And update the `intermediate` path to use the already-correct `intermediate`
variable (which is `''` for non-lynx) instead of the hardcoded
`DEFAULT_INTERMEDIATE`:

```ts
intermediate: path.posix.join(intermediate, entryName),
```

(The `intermediate` variable at line 296 is already
`isLynx ? DEFAULT_INTERMEDIATE : ''`, which produces the correct empty string
for web.)

### Step 5: Apply `VueMainThreadPlugin` + `VueWorkletRuntimePlugin` for both

Change:

```ts
if (isLynx && mainThreadFilenames.length > 0) {
```

to:

```ts
if ((isLynx || isWeb) && mainThreadFilenames.length > 0) {
```

Both plugins are needed for web because:

- `VueMainThreadPlugin`: the flat main-thread bundle must replace the
  webpack-generated stub and be marked `lynx:main-thread: true` for
  `LynxTemplatePlugin` to route it to `lepusCode.root`.
- `VueWorkletRuntimePlugin`: the worklet-runtime chunk must be present for
  MTS event dispatch to work in web preview.

### Step 6: Apply `WebEncodePlugin` for web (new block)

After the existing `if (isLynx)` block that registers
`RuntimeWrapperWebpackPlugin` + `LynxEncodePlugin`, add:

```ts
if (isWeb) {
  chain
    .plugin(PLUGIN_WEB_ENCODE)
    .use(WebEncodePlugin, [])
    .end();
}
```

The `RuntimeWrapperWebpackPlugin` and `LynxEncodePlugin` remain guarded by
`if (isLynx)` only — web bundles don't need the AMD wrapper or Lynx binary
encoding.

### Step 7: Update e2e config

In `packages/vue/e2e-lynx/lynx.config.ts`, add:

```ts
environments: {
  web: {},
  lynx: {},
},
```

## Summary of guard changes

| Block                         | Current guard         | New guard                         |
| ----------------------------- | --------------------- | --------------------------------- |
| CSS ignore-loader             | `if (!isLynx) return` | `if (!isLynx && !isWeb) return`   |
| Worklet loader                | `if (!isLynx) return` | `if (!isLynx && !isWeb) return`   |
| `mainThreadFilenames.push`    | `if (isLynx)`         | `if (isLynx \|\| isWeb)`          |
| `LynxTemplatePlugin`          | `if (isLynx)`         | `if (isLynx \|\| isWeb)`          |
| `VueMainThreadPlugin`         | `if (isLynx && ...)`  | `if ((isLynx \|\| isWeb) && ...)` |
| `VueWorkletRuntimePlugin`     | (same block)          | (same block)                      |
| `RuntimeWrapperWebpackPlugin` | `if (isLynx)`         | `if (isLynx)` — **no change**     |
| `LynxEncodePlugin`            | `if (isLynx)`         | `if (isLynx)` — **no change**     |
| `WebEncodePlugin`             | (none)                | `if (isWeb)` — **new**            |

## Risks

- **Worklet-runtime in web**: the web preview runtime may not support
  `__LoadLepusChunk`. If so, MTS demos will fail in web preview but non-MTS
  demos will work fine. This matches React's behavior (MTS is a native-only
  feature).
- **No web-specific Vue runtime**: unlike React which has `@lynx-js/web-*`
  packages, Vue currently has no web-specific renderer. The web preview uses
  the same LynxTemplatePlugin packaging as lynx, and the web runtime (from
  `@lynx-js/web-core`) interprets the bundle. No Vue-side changes are needed.

## Verification

1. `pnpm dev` in `packages/vue/e2e-lynx` should print both `.lynx.bundle` and
   `.web.bundle` URLs for each entry
2. Opening `/__web_preview` in a browser should show the web preview
3. Non-MTS entries (counter, todomvc, gallery-list) should render in web preview
4. Existing lynx bundles should continue working unchanged
