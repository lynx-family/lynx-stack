// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGES } from './packages.ts';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(DOCS, '..');
const EN = join(DOCS, 'content/en');

function write(rel: string, content: string) {
  const p = join(EN, rel);
  if (existsSync(p)) {
    console.info(`keep    ${rel}`);
    return;
  }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  console.info(`created ${rel}`);
}

function readmeIntro(dir: string): string {
  const p = join(ROOT, dir, 'README.md');
  if (!existsSync(p)) return '';
  const lines = readFileSync(p, 'utf8').split('\n');
  const paras: string[] = [];
  let cur: string[] = [];
  let started = false;
  for (const line of lines) {
    if (line.startsWith('#')) {
      if (started) break;
      started = true;
      continue;
    }
    if (!started) continue;
    if (/^\s*(?:<|\[!\[|!\[)/.test(line)) continue;
    if (line.trim() === '') {
      if (cur.length > 0) {
        paras.push(cur.join(' '));
        cur = [];
      }
      if (paras.length >= 2) break;
      continue;
    }
    if (/^(?:```|##)/.test(line)) break;
    cur.push(line.trim());
  }
  if (cur.length > 0) paras.push(cur.join(' '));
  return paras.join('\n\n').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

const CONFIG_INTROS: Record<string, string> = {
  dev:
    'Options for the development server and hot module replacement: what the dev client connects to, how updates are delivered to the device and whether the bundle is written to disk while developing.',
  environments:
    'Rspeedy builds one Lynx bundle per Rsbuild environment. `environments` is the [Rsbuild `environments` option](https://rsbuild.rs/config/environments); the environment name becomes the `[platform]` placeholder of `output.filename.bundle`.',
  mode:
    'The build mode. It is the [Rsbuild `mode` option](https://rsbuild.rs/config/mode) and defaults to `production` for `rspeedy build` and `development` for `rspeedy dev`.',
  performance:
    'Options that trade build output for runtime performance: chunk splitting, console removal, runtime profiling and the bundle analyzer.',
  plugins:
    'The list of Rsbuild plugins to apply. It is the [Rsbuild `plugins` option](https://rsbuild.rs/config/plugins); Rspeedy applies [`pluginLynx`](/rspeedy/plugins/plugin-lynx) itself before the plugins listed here.',
  resolve:
    'Options for how module specifiers are resolved: aliases, extensions and the `lynx` export condition that Rspeedy adds by default.',
  server:
    'Options for the local server that serves the bundle to the device during development: host, port, headers and the base path.',
  source:
    'Options for what goes into the build: entries, `define` constants, `include`/`exclude` rules and the TypeScript path aliases Rspeedy reads from `tsconfig.json`.',
  splitChunks:
    'Chunk splitting is the [Rsbuild `performance.chunkSplit` option](https://rsbuild.rs/config/performance/chunk-split) lifted to the top level. Enabling it turns off `output.inlineScripts` so that background-thread chunks are emitted as separate files.',
  tools:
    'Escape hatches to the underlying tools: modify the Rspack configuration, the SWC options or the Rsbuild config directly when an option is not exposed by Rspeedy.',
};

for (const ns of Object.keys(CONFIG_INTROS)) {
  write(
    `rspeedy/config/${ns}.mdx`,
    `---
title: ${ns}
---

# ${ns}

${CONFIG_INTROS[ns]}

## At a glance

{/* @api ConfigOverview package="rspeedy" type="Config" path="${ns}" */}
{/* @api-end */}

## Options

{/* @api ConfigOptions package="rspeedy" type="Config" path="${ns}" */}
{/* @api-end */}
`,
  );
}

write(
  'rspeedy/config/index.mdx',
  `---
title: Configuration
---

# Configuration

Rspeedy reads \`lynx.config.ts\` (or \`.js\`, \`.mjs\`) from the project root. Wrap the object in \`defineConfig\` from \`@lynx-js/rspeedy\` to get completion and type checking:

\`\`\`ts title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

export default defineConfig({
  source: {
    entry: './src/index.tsx',
  },
  plugins: [pluginReactLynx()],
})
\`\`\`

The options are a subset of the [Rsbuild configuration](https://rsbuild.rs/config/). Options that would break a Lynx bundle (\`html\`, \`security\`, \`moduleFederation\`, the polyfill settings) are not exposed; the ones below are, with Lynx-specific defaults where they differ from Rsbuild.

## All options

{/* @api ConfigOverview package="rspeedy" type="Config" */}
{/* @api-end */}

## Namespaces

- [dev](/rspeedy/config/dev) · [environments](/rspeedy/config/environments) · [mode](/rspeedy/config/mode) · [output](/rspeedy/config/output) · [performance](/rspeedy/config/performance) · [plugins](/rspeedy/config/plugins) · [resolve](/rspeedy/config/resolve) · [server](/rspeedy/config/server) · [source](/rspeedy/config/source) · [splitChunks](/rspeedy/config/splitChunks) · [tools](/rspeedy/config/tools)
`,
);

write(
  'rspeedy/api/index.mdx',
  `---
title: JavaScript API
---

# JavaScript API

The programmatic API of \`@lynx-js/rspeedy\`: load a config, create an Rspeedy instance and drive builds from a script instead of the CLI.

{/* @api PackageHeader package="rspeedy" */}
{/* @api-end */}

\`\`\`ts
import { createRspeedy, loadConfig } from '@lynx-js/rspeedy'

const { content: config } = await loadConfig({ cwd: process.cwd() })
const rspeedy = await createRspeedy({ rspeedyConfig: config })
await rspeedy.build()
\`\`\`

{/* @api ApiExports package="rspeedy" exclude="Config,Dev,DevClient,Output,Performance,Resolve,Server,Source,Tools,Filename,BundleFilenameContext,BundleFilename,CssModules,CssModuleLocalsConvention,Minify,SourceMap,DistPath,ChunkSplit,ChunkSplitBySize,ChunkSplitCustom,ConsoleType,TransformImport,Entry,EntryDescription,CssLoaderOptions,CssExtractRspackPluginOptions,CssExtractRspackLoaderOptions,Profile" */}
{/* @api-end */}
`,
);

const PLUGINS: {
  file: string;
  id: string;
  fn: string;
  options: string;
  intro: string;
}[] = [
  {
    file: 'plugin-react',
    id: 'react-rsbuild-plugin',
    fn: 'pluginReactLynx',
    options: 'PluginReactLynxOptions',
    intro:
      'The ReactLynx DSL plugin. It compiles JSX into the dual-thread output of ReactLynx, wires up the runtime and enables Fast Refresh in development. It registers [`pluginLynx`](/rspeedy/plugins/plugin-lynx) automatically when the build engine is not already there.',
  },
  {
    file: 'plugin-qrcode',
    id: 'qrcode-rsbuild-plugin',
    fn: 'pluginQRCode',
    options: 'PluginQRCodeOptions',
    intro:
      'Prints a QR code of the bundle URL in the terminal during `dev`, so a Lynx Explorer app can scan it and load the bundle from the local server.',
  },
  {
    file: 'plugin-external-bundle',
    id: 'external-bundle-rsbuild-plugin',
    fn: 'pluginExternalBundle',
    options: 'PluginExternalBundleOptions',
    intro:
      'Builds an external bundle: a Lynx bundle whose modules are loaded on demand by a host bundle at runtime instead of being inlined.',
  },
  {
    file: 'plugin-vanilla',
    id: 'vanilla-rsbuild-plugin',
    fn: 'pluginVanillaLynx',
    options: 'PluginVanillaLynxOptions',
    intro:
      'The Vanilla DSL plugin. It builds a Lynx bundle from plain JavaScript that talks to the Element PAPI directly, without a UI framework.',
  },
  {
    file: 'plugin-config',
    id: 'config-rsbuild-plugin',
    fn: 'pluginLynxConfig',
    options: 'PluginLynxConfigOptions',
    intro:
      'Writes Lynx engine configuration (page config such as `enableCSSSelector` or `enableRemoveCSSScope`) into the bundle. This is not a DSL plugin; use it next to one.',
  },
  {
    file: 'plugin-debug-metadata',
    id: 'debug-metadata-rsbuild-plugin',
    fn: 'pluginLynxDebugMetadata',
    options: 'PluginLynxDebugMetadataOptions',
    intro:
      'Emits a `debug-metadata.json` next to the bundle with the information Lynx DevTool needs to map runtime errors back to the source. [`pluginLynx`](/rspeedy/plugins/plugin-lynx) applies it by default.',
  },
  {
    file: 'plugin-react-alias',
    id: 'react-alias-rsbuild-plugin',
    fn: 'pluginReactAlias',
    options: 'PluginReactAliasOptions',
    intro:
      'Aliases `react` and `react-dom` imports to `@lynx-js/react`, so libraries written against React resolve to the ReactLynx runtime.',
  },
  {
    file: 'lynx-bundle-rslib-config',
    id: 'lynx-bundle-rslib-config',
    fn: 'lynxBundle',
    options: 'LynxBundleOptions',
    intro:
      'An Rslib configuration helper for building a Lynx bundle as a library artifact with `@rslib/core`.',
  },
];

for (const p of PLUGINS) {
  const src = PACKAGES.find(e => e.id === p.id)!;
  write(
    `rspeedy/plugins/${p.file}.mdx`,
    `---
title: ${p.fn}
---

# ${p.fn}

{/* @api PackageHeader package="${p.id}" */}
{/* @api-end */}

${p.intro}

## Installation

import { PackageManagerTabs } from '@rspress/core/theme';

<PackageManagerTabs command="add @lynx-js/${p.id} -D" />

## Usage

\`\`\`ts title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy'
import { ${p.fn} } from '@lynx-js/${p.id}'

export default defineConfig({
  plugins: [${p.fn}()],
})
\`\`\`

## Options

{/* @api ApiOptions package="${p.id}" type="${p.options}" */}
{/* @api-end */}

## API

{/* @api ApiExports package="${p.id}" exclude="${p.options}" optionsType="${p.options}" */}
{/* @api-end */}
`,
  );
  void src;
}

const REACT_PAGES: {
  file: string;
  title: string;
  intro: string;
  include: string;
  extra?: string;
}[] = [
  {
    file: 'hooks',
    title: 'Hooks',
    include:
      'useInitData,useInitDataChanged,useGlobalProps,useGlobalPropsChanged,useLynxGlobalEventListener,useMainThreadRef,useEffect,useLayoutEffect',
    intro:
      'Hooks that ReactLynx adds on top of React, plus the two React hooks it re-implements for the dual-thread model.',
    extra: `
## Built-in React hooks

\`useCallback\`, \`useContext\`, \`useDebugValue\`, \`useImperativeHandle\`, \`useMemo\`, \`useReducer\`, \`useRef\`, \`useState\` and \`useSyncExternalStore\` are re-exported from React unchanged. See the [React reference](https://react.dev/reference/react/hooks).
`,
  },
  {
    file: 'components',
    title: 'Components',
    include:
      'GlobalPropsProvider,GlobalPropsConsumer,InitDataProvider,InitDataConsumer',
    intro:
      'Provider and consumer components for the data a Lynx page receives from the native side.',
    extra: `
## Built-in React components

\`Fragment\` and \`Suspense\` are re-exported from React. \`Component\` and \`PureComponent\` are the React class component base classes; see the [React reference](https://react.dev/reference/react/components).
`,
  },
  {
    file: 'functions',
    title: 'Functions',
    include:
      'createPortal,createElement,cloneElement,runOnMainThread,runOnBackground,markFirstScreenSyncReady,withInitDataInState,root,Children',
    intro:
      'Functions for crossing the thread boundary, creating elements outside JSX and mounting the root.',
    extra: `
## Built-in React APIs

\`createContext\`, \`forwardRef\`, \`lazy\`, \`memo\`, \`createRef\` and \`isValidElement\` are re-exported from React unchanged. See the [React reference](https://react.dev/reference/react/apis).
`,
  },
  {
    file: 'types',
    title: 'Types',
    include:
      'MainThreadRef,InitData,InitDataRaw,GlobalProps,Lynx,Root,DataProcessors,DataProcessorDefinition,CloneElement,CreateElement,ReactLynxChildren',
    intro:
      'The types and classes exported by `@lynx-js/react`. Augment `InitData` and `GlobalProps` in your project to type the data your page receives.',
  },
];

for (const p of REACT_PAGES) {
  write(
    `react/api/${p.file}.mdx`,
    `---
title: ${p.title}
---

# ${p.title}

${p.intro}

{/* @api ApiExports package="react" include="${p.include}" */}
{/* @api-end */}
${p.extra ?? ''}`,
  );
}

write(
  'react/api/index.mdx',
  `---
title: ReactLynx API
---

# ReactLynx API

{/* @api PackageHeader package="react" */}
{/* @api-end */}

\`@lynx-js/react\` is React for Lynx. It keeps the React 17 API surface, re-exporting the standard hooks and APIs, and adds what the dual-thread model needs: main-thread functions, the data a page receives from native, and a few compile-time directives and macros.

| | |
| --- | --- |
| [Hooks](/react/api/hooks) | \`useInitData\`, \`useGlobalProps\`, \`useMainThreadRef\`, \`useLynxGlobalEventListener\` … |
| [Components](/react/api/components) | \`InitDataProvider\`, \`GlobalPropsProvider\` and their consumers |
| [Functions](/react/api/functions) | \`runOnMainThread\`, \`runOnBackground\`, \`createPortal\`, \`root\` … |
| [Types](/react/api/types) | \`InitData\`, \`GlobalProps\`, \`Lynx\`, \`MainThreadRef\` … |
| [Directives](/react/api/directives) | \`'background only'\`, \`'main thread'\` |
| [Macros](/react/api/macros) | \`__BACKGROUND__\`, \`__MAIN_THREAD__\`, \`__DEV__\`, \`__PROFILE__\` … |
| [Testing Library](/react/api/testing-library) | \`render\`, \`fireEvent\`, \`waitFor\` from \`@lynx-js/react/testing-library\` |
`,
);

write(
  'react/api/testing-library.mdx',
  `---
title: Testing Library
---

# Testing Library

\`@lynx-js/react/testing-library\` renders ReactLynx components in a simulated dual-thread environment so they can be tested with Vitest or Rstest, following the [Testing Library](https://testing-library.com/) conventions.

:::info
The reference for this entry is not generated yet: its \`types/index.d.ts\` depends on the built runtime. Until the pipeline covers it, see the [guide on lynxjs.org](https://lynxjs.org/react/reactlynx-testing-library).
:::
`,
);

const index = JSON.parse(
  readFileSync(join(DOCS, 'api-data/index.json'), 'utf8'),
) as Record<
  string,
  {
    package: string;
    version: string;
    section: string;
    internal?: boolean;
    description?: string;
    exports: number;
  }
>;

const groups: Record<string, string[]> = {
  'Web platform': [],
  'Build internals (webpack plugins)': [],
  'Libraries and tools': [],
};
for (const entry of PACKAGES) {
  if (entry.section !== 'packages') continue;
  const meta = index[entry.id];
  const name = meta?.package ?? `@lynx-js/${entry.id}`;
  const g = entry.dir.startsWith('packages/web-platform')
    ? 'Web platform'
    : (entry.internal
      ? 'Build internals (webpack plugins)'
      : 'Libraries and tools');
  groups[g]!.push(entry.id);
  const intro = readmeIntro(entry.dir) || (meta?.description ?? '');
  const hasApi = (meta?.exports ?? 0) > 0;
  write(
    `packages/${entry.id}.mdx`,
    `---
title: '${name}'
---

# ${name}

${
      meta
        ? `{/* @api PackageHeader package="${entry.id}" */}
{/* @api-end */}
`
        : ''
    }
${
      entry.internal
        ? `:::tip Internal package
This package is part of the Lynx build engine and is applied for you by [\`pluginLynx\`](/rspeedy/plugins/plugin-lynx). Its API is documented for plugin authors; application code does not use it directly.
:::
`
        : ''
    }
${intro}

## Installation

import { PackageManagerTabs } from '@rspress/core/theme';

<PackageManagerTabs command="add ${name}${
      entry.internal || /plugin|config|webpack/.test(entry.id) ? ' -D' : ''
    }" />
${
      hasApi
        ? `
## API

{/* @api ApiExports package="${entry.id}" */}
{/* @api-end */}
`
        : `
## API

This package has no TypeScript exports to document. See its [README](https://github.com/lynx-family/lynx-stack/tree/main/${entry.dir}).
`
    }`,
  );
}

let idx = `---
title: Packages
---

# Packages

Every public package published from [lynx-stack](https://github.com/lynx-family/lynx-stack). Packages with a dedicated section link there.

## Rspeedy and plugins

| Package | |
| --- | --- |
| \`@lynx-js/rspeedy\` | [Configuration](/rspeedy/config/) · [JavaScript API](/rspeedy/api/) |
| \`@lynx-js/rsbuild-plugin\` | [pluginLynx](/rspeedy/plugins/plugin-lynx) |
| \`@lynx-js/react-rsbuild-plugin\` | [pluginReactLynx](/rspeedy/plugins/plugin-react) |
| \`@lynx-js/qrcode-rsbuild-plugin\` | [pluginQRCode](/rspeedy/plugins/plugin-qrcode) |
| \`@lynx-js/external-bundle-rsbuild-plugin\` | [pluginExternalBundle](/rspeedy/plugins/plugin-external-bundle) |
| \`@lynx-js/vanilla-rsbuild-plugin\` | [pluginVanillaLynx](/rspeedy/plugins/plugin-vanilla) |
| \`@lynx-js/config-rsbuild-plugin\` | [pluginLynxConfig](/rspeedy/plugins/plugin-config) |
| \`@lynx-js/debug-metadata-rsbuild-plugin\` | [pluginLynxDebugMetadata](/rspeedy/plugins/plugin-debug-metadata) |
| \`@lynx-js/react-alias-rsbuild-plugin\` | [pluginReactAlias](/rspeedy/plugins/plugin-react-alias) |
| \`@lynx-js/lynx-bundle-rslib-config\` | [lynxBundle](/rspeedy/plugins/lynx-bundle-rslib-config) |

## ReactLynx

| Package | |
| --- | --- |
| \`@lynx-js/react\` | [API reference](/react/api/) |
| \`@lynx-js/react/testing-library\` | [Testing Library](/react/api/testing-library) |
`;
for (const [g, ids] of Object.entries(groups)) {
  if (ids.length === 0) continue;
  idx +=
    `\n## ${g}\n\n| Package | Version | Description |\n| --- | --- | --- |\n`;
  for (const id of ids) {
    const m = index[id];
    idx += `| [\`${m?.package ?? '@lynx-js/' + id}\`](/packages/${id}) | ${
      m ? m.version : ''
    } | ${(m?.description ?? '').replace(/\|/g, '\\|')} |\n`;
  }
}
write('packages/index.mdx', idx);

const pkgMeta: (string | { type: string; label: string })[] = ['index'];
for (const [g, ids] of Object.entries(groups)) {
  if (ids.length === 0) continue;
  pkgMeta.push({ type: 'section-header', label: g });
  pkgMeta.push(...ids);
}
const metaPath = join(EN, 'packages/_meta.json');
if (!existsSync(metaPath)) {
  writeFileSync(metaPath, JSON.stringify(pkgMeta, null, 2) + '\n');
  console.info('created packages/_meta.json');
}
