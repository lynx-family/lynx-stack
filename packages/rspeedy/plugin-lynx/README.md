# @lynx-js/rsbuild-plugin

The shared Lynx build engine for Rsbuild and Rspeedy. It handles Lynx module
resolution, thread assets, CSS, and native or Web bundle encoding.

## Direct Element PAPI applications

Without a DSL plugin, `pluginLynx()` builds Vanilla Lynx bundles from the
standard Rsbuild `source.entry` configuration:

```ts
import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  source: {
    entry: {
      main: './src/index.ts',
    },
  },
  environments: { lynx: {}, web: {} },
  plugins: [pluginLynx()],
})
```

The build emits `main.lynx.bundle` and `main.web.bundle`. Each page entry
compiles for both threads. Import the two setup functions and select the
thread with the compile-time macros.

```ts title="src/index.ts"
import { setUpBackgroundThread } from './background.js'
import { setUpMainThread } from './main-thread.js'

if (__MAIN_THREAD__) {
  setUpMainThread()
} else if (__BACKGROUND__) {
  setUpBackgroundThread()
}
```

Put initialization inside the setup functions and import page styles from the
main thread. SWC removes the inactive branch, and Rspack analyzes module side
effects in both development and production. An unused setup module can then be
omitted from the background build even when it imports a page stylesheet.

String, array, and description entries use Rsbuild module resolution, aliases,
`source.preEntry`, and environment configuration. The engine manages the thread
layers and intermediate filenames. No sibling files are discovered. Keep Element
PAPI tree creation and mutation on the main thread.

Each thread entry must emit one self-contained JavaScript file. Independent
runtimes, shared chunks, `dependOn`, and dynamic imports that generate async
chunks are rejected during compilation. Use `performance.chunkSplit.strategy:
'all-in-one'` to disable automatic splitting and keep each runtime in its entry.

Direct entries use the encoder and runtime wrapper's default engine version
(`3.2`). Use `output.filename.bundle` to customize bundle names.
Set page options such as `enableEventHandleRefactor` through
`pluginLynxConfig`; entry assembly does not inject them.
Direct entries do not install a hot-update or live-reload client, and their
compilation omits the HMR plugin. After the dev server rebuilds, reload the page
in its host. The application owns its state,
node updates, lifecycle, and communication between threads.

This entry path supports engine API examples, small direct-rendered pages, and
code produced by a custom renderer or compiler. It does not install a component
framework or promise a performance improvement over one. The template's
`react_nodiff` encoding mode refers to the engine's Element PAPI format and does
not add a React runtime.

## LynXML applications

Point `source.entry` at a `.lynxml` file to build it with the same Vanilla
pipeline:

```ts
export default defineConfig({
  source: { entry: { main: './src/index.lynxml' } },
  environments: { lynx: {}, web: {} },
  plugins: [pluginLynx()],
})
```

```xml title="src/index.lynxml"
<!doctype lynx>
<lynx engine-version="4.2">
<style>
.content { width: 100px; height: 100px; background-color: red; }
</style>
<script thread="main">
lynx.getEngine().addEventListener('__RenderPage', () => {
  const page = __CreatePage('0', 0);
  const pageId = __GetElementUniqueID(page);
  const content = __CreateView(pageId);
  __SetClasses(content, 'content');
  __AppendElement(page, content);
});
</script>
</lynx>
```

The shared `@lynx-js/lynx-xml/parser` validates the document. A main-thread script
is required; the stylesheet and background script are optional. JavaScript
imports, CSS `@import`, and asset URLs resolve relative to the XML file. Each
script goes through its thread's SWC pipeline, including thread macros. Styles
use the configured CSS loaders and are collected only from the main thread.
XML syntax errors fail compilation with the parser's offset and message.

The `engine-version` attribute is validated as part of the XML syntax. This
build path uses the Vanilla encoder and runtime wrapper's default version
(`3.2`); the attribute does not override those options.

## Framework applications

A framework plugin such as `pluginReactLynx` generates its own thread entries.
The Vanilla fallback runs after DSL bundler-chain hooks. A DSL identifies its
entries by assigning its own layers. Separate environments may use a DSL and
Vanilla. Mixing their entry layers within one environment is rejected.
ReactLynx registers the build engine when needed; add `pluginLynx` explicitly to customize engine options.

Configure ReactLynx's engine version with `pluginReactLynx({ engineVersion })`.
It takes precedence over the deprecated `targetSdkVersion` alias and defaults
to `3.2`.

## Polyfills

Polyfills are off by default. To inject them on demand, install `core-js` in
your application and set `output.polyfill` to `'usage'`. The `'entry'` mode
is also supported and requires an explicit `core-js` import. Lynx builds use
Chrome 92 as an approximation for selecting polyfills; verify API availability
for the Lynx runtimes you support.
