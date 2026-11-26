# @lynx-js/web-bundle-kit

Builds Lynx web bundles (`<entry>.web.bundle`) in a browser. It runs Rsbuild with `pluginLynx` and `pluginReactLynx` on top of `@rspack/browser`, on a ReactLynx project that lives in memory.

Private; used by `@lynx-js/web-preview-kit`. The contract is [`src/types.ts`](src/types.ts).

## Usage

Import `dist/index.js` in a dedicated **module** Worker of a **cross-origin isolated** page.

```js
// worker.js, started with new Worker(url, { type: 'module' })
import { createWebBundler } from '@lynx-js/web-bundle-kit';

const bundler = await createWebBundler({
  entries: { main: 'src/index.tsx' },
  publicPath: 'https://example.com/preview/',
  mode: 'development',
  files: { 'src/index.tsx': '...' },
});
await bundler.watch((event) => {
  if (event.type === 'done') { /* serve event.result.emitted at publicPath */ }
});
await bundler.applyChanges([{
  type: 'write',
  path: 'src/App.tsx',
  content: '...',
}]);
```

Serving requirements:

- Serve all of `dist/` (`index.js`, `chunks/`, `assets/`, `mirror.json`) from one directory. The kit finds its chunks, the Rspack wasm (about 28 MB) and `mirror.json` relative to `index.js`.
- The page must be cross-origin isolated: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, on a secure context (`https:` or `localhost`). Files of `dist/` need `Cross-Origin-Resource-Policy` when served from another origin. `.wasm` must be served as `application/wasm`.
- `@rspack/browser` starts its own thread workers from a `blob:` URL.

The first `createWebBundler` call loads Rspack and the mirror; later bundlers in the same Worker reuse them.

## How it works

- **One file system.** Node.js `fs` is the memfs of `@rspack/browser`, so Rsbuild, the plugins and Rspack all see the same files. Projects live under `/project` (`/project-<n>` for later bundlers), output under `/.web-bundle-kit/<n>/dist`.
- **A virtual `node_modules`.** At build time, `scripts/layout.mjs` lays out every package the kit bundles or provides as a hoisted tree under `/node_modules`. `scripts/virtual-path-loader.cjs` gives each bundled module its place in that tree as `import.meta.url` and `__dirname`. `mirror.json` puts `package.json` files, the runtime files compiled into cards (`@lynx-js/react`, `@swc/helpers`, the HMR client, the CSS and React Refresh runtimes, ...) and placeholders for bundled modules there. A project's own `node_modules` comes first in resolution.
- **Node.js built-ins** are replaced by `src/node/*.cjs`. `createRequire(...).resolve` resolves in memfs with Rspack's resolver; `createRequire(...)(id)` returns a built-in stand-in, a bundled module registered under its virtual path (loaders and the ReactLynx transform; see `registered` in `scripts/build.mjs`), or a JSON file. Loaders reach Rspack through `BrowserRequirePlugin` from the same registry.
- **Rebuilds.** The compiler's watch file system does not watch: `applyChanges` reports what it changed, and each call causes one rebuild. `emitted` is computed by comparing asset contents with the previous build.
- **Stringified runtimes.** Some plugins inject functions into cards as source text (`Template.getFunctionContent(fn)`, that is `fn.toString()`). Bundling the kit would rewrite that text (Rspack renames `__webpack_require__`; a minifier would rename the rest), and the card would get identifiers that do not exist in it. `scripts/verbatim-functions-loader.cjs` gives every top-level function of the modules in `STRINGIFIED` (`scripts/build.mjs`) a `toString` that returns its text as published, as a string literal. The build fails when a pattern matches nothing, a listed module has no top-level function, or a listed module is not bundled.
- **Hot updates.** The dev bundle uses `LynxTransportClient` (messages through `lynx.getDevtool()`); the WebSocket client that pluginLynx provides is removed with `tools.bundlerChain`.

## Scripts

- `pnpm turbo build --filter=@lynx-js/web-bundle-kit`: build `dist/`.
- `pnpm run test --project web-platform/web-bundle-kit`: unit tests of path checks, change application, diagnostics and the watch file system.
- `node e2e/run.mjs` (after a build): end-to-end test in Chromium with Playwright. It builds `e2e/fixture` (two cards, CSS, a CSS module and an image) in production and renders it in `<lynx-view>`, then watches with hot updates: it checks that the development cards use the same `__name__` identifiers as a Node.js build of the fixture (`e2e/node-build.mjs`), renders the development card, edits CSS and TSX and applies each hot update in the card, introduces and fixes a syntax error, and checks that the project's `node_modules` wins over the mirror. `KIT_E2E_BAIL=1` stops at the first failure; `KIT_E2E_VERBOSE=1` prints warnings and the browser console.

## Adding to the kit

- A new loader used by the plugins: add it to `registered` in `scripts/build.mjs`.
- A new file compiled into cards (a runtime): add its package or folder to `RUNTIME_FILES` in `scripts/mirror.mjs`.
- A new module whose functions a plugin stringifies into cards (`Template.getFunctionContent`, `fn.toString()`): add it to `STRINGIFIED` in `scripts/build.mjs`. Its functions must be top-level declarations, and the caller must use `fn.toString()`, not `Function.prototype.toString.call(fn)`. Search the plugins for `getFunctionContent` and `toString()` when you update them.
- A new Node.js built-in: add a stand-in to `src/node/builtins.cjs`.
