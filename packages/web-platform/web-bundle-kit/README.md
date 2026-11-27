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
- **A virtual `node_modules`.** At build time, `scripts/layout.ts` lays out every package the kit bundles or provides as a hoisted tree under `/node_modules`. `scripts/virtual-paths.ts` gives each bundled module its place in that tree as `import.meta.url` and `__dirname`. `mirror.json` puts `package.json` files, the runtime files compiled into cards (`@lynx-js/react`, `@swc/helpers`, the HMR client, the CSS and React Refresh runtimes, ...) and placeholders for bundled modules there. A project's own `node_modules` comes first in resolution.
- **Node.js built-ins** are what `pluginNodePolyfill` (`@rsbuild/plugin-node-polyfill`) makes them, with the options in `scripts/builtins.ts`: the plugin's polyfill, an npm package (`assert`, `events`, `querystring`, `stream`, `string_decoder`, `tty`, `zlib`); an override, an ES module of `src/node`; or an empty module (`http`, `timers` and every other built-in that nothing in a web build runs). The overrides are the memfs `fs`, `fs/promises` and `Buffer` of `@rspack/browser`, `module`, `process`, `crypto`, wrappers of the npm packages for `url` and `util` (and `util/types`) that add the members bundled code uses (`fileURLToPath`, `styleText`, ...), `path` (with `win32` and `toNamespacedPath`), `os`, and traps for `child_process`, `net`, `readline`, `vm`, `v8`, `perf_hooks` and `worker_threads`: they export every key of the Node.js 24 module, and using a member throws. Each override has a named export for every member and a default export with all of them. ES module imports get the members by name, so a missing one fails the kit's build; CommonJS `require()` in bundled code gets the module namespace, that is the named exports, and CommonJS `require()` of a plugin polyfill gets what the npm package exports. `crypto` computes `sha1` and `sha256` with `@noble/hashes`. `fs` forwards to the memfs of `@rspack/browser`, which only exists after setup. `createRequire(...).resolve` resolves in memfs with Rspack's resolver; `createRequire(...)(id)` returns a built-in, a bundled module registered under its virtual path (loaders and the ReactLynx transform; see `REGISTERED` in `rslib.config.ts`), or a JSON file. Loaders reach Rspack through `BrowserRequirePlugin` from the same registry.
- **Rebuilds.** The compiler's watch file system does not watch: `applyChanges` reports what it changed, and each call causes one rebuild. `emitted` is computed by comparing asset contents with the previous build.
- **Stringified runtimes.** Some plugins inject functions into cards as source text (`Template.getFunctionContent(fn)`, that is `fn.toString()`). Bundling the kit would rewrite that text (Rspack renames `__webpack_require__`; a minifier would rename the rest), and the card would get identifiers that do not exist in it. `scripts/verbatim-functions.ts` gives every top-level function of the modules in `STRINGIFIED` (`rslib.config.ts`) a `toString` that returns its text as published, as a string literal. The build fails when a pattern matches nothing, a listed module has no top-level function, or a listed module is not bundled.
- **Hot updates.** The dev bundle uses `LynxTransportClient` (messages through `lynx.getDevtool()`); the WebSocket client that pluginLynx provides is removed with `tools.bundlerChain`.

## Build

`rslib build` builds `dist/` from `rslib.config.ts`: one ES module library with everything bundled, as `@rspack/browser` builds itself. Two plugins say what each Node.js built-in becomes: `pluginNodePolyfill` with the options of `scripts/builtins.ts`, and `pluginBuiltinAliases`, which turns the plugin's `resolve.fallback` into exact aliases, so that an npm package of the same name (pnpm hoists `url`, `util` and `process`) never takes a built-in's place. The config computes the layout of the virtual `node_modules` once and gives it to the kit's Rsbuild plugin (`scripts/plugin.ts`), which uses it for three things that must agree on the virtual paths:

- `api.transform` replaces the content of `src/registered.ts`, a typed stub, with the modules of `REGISTERED`, each under its virtual path.
- `api.transform` rewrites every bundled script outside the kit's own code and `@rspack/browser`: the functions of `STRINGIFIED` files keep their published text, then the module gets its virtual location. One transform does both, in that order, because the first must see the published text. The polyfill packages use no location of their own and are left as they are.
- `api.processAssets` emits `mirror.json` from the modules of the compilation, and fails the build when a `STRINGIFIED` file is not bundled.

The plugin also keeps only the kit's own build-time constants (`__BUILTIN_PACKAGES__`, `__non_webpack_require__`): Rsbuild's `import.meta.env.*`, `process.env.BASE_URL`, `process.env.ASSET_PREFIX` and `PUBLIC_*` variables are not defined, and `optimization.nodeEnv` is off, so the bundled toolchain reads `process.env.NODE_ENV` at run time. Rslib's defaults are for a library that another bundler or Node.js loads; the config overrides the ones that would break the kit in a Worker, and each override says why. The build writes nothing outside `dist/`.

## Scripts

- `pnpm turbo build --filter=@lynx-js/web-bundle-kit`: build `dist/`.
- `pnpm run test --project web-platform/web-bundle-kit`: unit tests of path checks, change application, diagnostics, the watch file system, the path mapping and the verbatim functions rewrite of the build scripts (paths run with `path.win32` too) and the Node.js built-ins (what each becomes, the exports of the overrides, and `createHash` against `node:crypto`).
- `pnpm run test:type` (after a build of the plugins): type-checks the kit, its build scripts, the end-to-end tests and the configs. The JavaScript of `e2e/page` is served to the browser as it is and is not checked; `e2e/fixture` has its own `tsconfig.json`. The kit is not part of the root `tsc --build`, because its sources need the type declarations of the plugins, which only their build produces; CI runs it in the `test-type` job (`pnpm -r run test:type`).
- `pnpm run test:e2e` (after `pnpm turbo build`): end-to-end tests in Chromium with Playwright Test (`playwright.config.ts`, specs in `e2e/*.spec.ts`). `page.route` serves the kit, web-core's client and the test page (`e2e/page`) from `http://localhost:4100` with the cross-origin isolation headers; no server is started. `production.spec.ts` builds `e2e/fixture` (two cards, CSS, a CSS module and an image) in production and renders it in `<lynx-view>`. `development.spec.ts` watches it with hot updates, in steps of one test that share the page and the bundler: it checks that the development cards use the same `__name__` identifiers as a Node.js build of the fixture (`e2e/node-build.ts`), renders the development card, edits CSS and TSX and applies each hot update in the card, introduces and fixes a syntax error, and checks that the project's `node_modules` wins over the mirror. Checks that later steps do not depend on are soft, so one failure does not hide the next. Build timings are annotations of the tests (`--reporter=html` or `--reporter=json` shows them); a failed test has the browser console attached and keeps its trace.

## Adding to the kit

- A new loader used by the plugins: add it to `REGISTERED` in `rslib.config.ts`.
- A new file compiled into cards (a runtime): add its package or folder to `RUNTIME_FILES` in `scripts/mirror.ts`.
- A new module whose functions a plugin stringifies into cards (`Template.getFunctionContent`, `fn.toString()`): add it to `STRINGIFIED` in `rslib.config.ts`. Its functions must be top-level declarations, and the caller must use `fn.toString()`, not `Function.prototype.toString.call(fn)`. Search the plugins for `getFunctionContent` and `toString()` when you update them.
- A Node.js built-in that bundled code starts to use: it is an empty module until `scripts/builtins.ts` lists it. Use the plugin's polyfill (add it to `polyfilled`) when it has the members bundled code uses, or add an ES module to `src/node`, with a named export for every member and a default export of the whole module, and list it in `overridden`. Add it to `builtinModules` and the table of `src/node/module.ts`, and to the lists in `test/node-stand-ins.test.ts`, which check that the two exports agree and that `module` lists every built-in that is not empty.
- Paths in `scripts/`: convert real paths to virtual paths, `mirror.json` keys or import specifiers, and compare them with Rspack's resource paths, with the helpers of `scripts/paths.ts`, so that the build also works on Windows.
