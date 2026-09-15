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

write(
  'config/index.mdx',
  `---
title: Config overview
pageType: doc-wide
outline: false
---

# Config overview

The options for building a Lynx app, whether with Rsbuild and \`pluginLynx\` or with Rspeedy.

## All options

{/* @api ConfigOverview package="rspeedy" */}
{/* @api-end */}
`,
);

write(
  'packages/rspeedy.mdx',
  `---
title: '@lynx-js/rspeedy'
---

# @lynx-js/rspeedy

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
  id: string;
  fn: string;
  options: string;
  intro: string;
}[] = [
  {
    id: 'react-rsbuild-plugin',
    fn: 'pluginReactLynx',
    options: 'PluginReactLynxOptions',
    intro:
      'The ReactLynx DSL plugin. It compiles JSX into the dual-thread output of ReactLynx, wires up the runtime and enables Fast Refresh in development. It registers [`pluginLynx`](/packages/rsbuild-plugin) automatically when the build engine is not already there.',
  },
  {
    id: 'qrcode-rsbuild-plugin',
    fn: 'pluginQRCode',
    options: 'PluginQRCodeOptions',
    intro:
      'Prints a QR code of the bundle URL in the terminal during `dev`, so a Lynx Explorer app can scan it and load the bundle from the local server.',
  },
  {
    id: 'external-bundle-rsbuild-plugin',
    fn: 'pluginExternalBundle',
    options: 'PluginExternalBundleOptions',
    intro:
      'Builds an external bundle: a Lynx bundle whose modules are loaded on demand by a host bundle at runtime instead of being inlined.',
  },
  {
    id: 'vanilla-rsbuild-plugin',
    fn: 'pluginVanillaLynx',
    options: 'PluginVanillaLynxOptions',
    intro:
      'The Vanilla DSL plugin. It builds a Lynx bundle from plain JavaScript that talks to the Element PAPI directly, without a UI framework.',
  },
  {
    id: 'config-rsbuild-plugin',
    fn: 'pluginLynxConfig',
    options: 'PluginLynxConfigOptions',
    intro:
      'Writes Lynx engine configuration (page config such as `enableCSSSelector` or `enableRemoveCSSScope`) into the bundle. This is not a DSL plugin; use it next to one.',
  },
  {
    id: 'debug-metadata-rsbuild-plugin',
    fn: 'pluginLynxDebugMetadata',
    options: 'PluginLynxDebugMetadataOptions',
    intro:
      'Emits a `debug-metadata.json` next to the bundle with the information Lynx DevTool needs to map runtime errors back to the source. [`pluginLynx`](/packages/rsbuild-plugin) applies it by default.',
  },
  {
    id: 'react-alias-rsbuild-plugin',
    fn: 'pluginReactAlias',
    options: 'PluginReactAliasOptions',
    intro:
      'Aliases `react` and `react-dom` imports to `@lynx-js/react`, so libraries written against React resolve to the ReactLynx runtime.',
  },
  {
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
    `packages/${p.id}.mdx`,
    `---
title: '@lynx-js/${p.id}'
---

# @lynx-js/${p.id}

{/* @api PackageHeader package="${p.id}" */}
{/* @api-end */}

${p.intro}

## Installation

import { PackageManagerTabs } from '@rspress/core/theme';

<PackageManagerTabs command="add @lynx-js/${p.id} -D" />

## Usage

With Rsbuild, register it in \`rsbuild.config.ts\`:

\`\`\`ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'
import { ${p.fn} } from '@lynx-js/${p.id}'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

export default defineConfig({
  environments: {
    lynx: {},
  },
  plugins: [pluginReactLynx(), ${p.fn}()],
})
\`\`\`

With Rspeedy, set it in \`lynx.config.ts\`:

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

\`useCallback\`, \`useContext\`, \`useDebugValue\`, \`useImperativeHandle\`, \`useMemo\`, \`useReducer\`, \`useRef\`, \`useState\` and \`useSyncExternalStore\` are re-exported from React. \`@lynx-js/react/compat\` also exports \`use\`, \`useTransition\` and \`useInsertionEffect\`, an alias of \`useEffect\`. See the [React reference](https://react.dev/reference/react/hooks).
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

\`createContext\`, \`forwardRef\`, \`lazy\`, \`memo\`, \`createRef\` and \`isValidElement\` are re-exported from React. As in React 19, function components receive \`ref\` as a regular prop, so a new component doesn't need \`forwardRef\`. \`@lynx-js/react/compat\` also exports \`startTransition\`. See the [React reference](https://react.dev/reference/react/apis).
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

\`@lynx-js/react\` is React for Lynx, built on Preact 11. It follows React 19: it re-exports the standard hooks and APIs, function components receive \`ref\` as a regular prop, and \`@lynx-js/react/compat\` adds \`use\`, \`useTransition\` and \`startTransition\`. On top of that it adds what the dual-thread model needs: main-thread functions, the data a page receives from native, and a few compile-time directives and macros.

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
    group: string;
    description?: string;
    exports: number;
  }
>;

for (const entry of PACKAGES) {
  if (entry.page) continue;
  const meta = index[entry.id];
  const name = meta?.package ?? `@lynx-js/${entry.id}`;
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
      entry.group === 'internals'
        ? `:::tip Internal package
This package is part of the Lynx build engine and is applied for you by [\`pluginLynx\`](/packages/rsbuild-plugin). Its API is documented for plugin authors; application code does not use it directly.
:::
`
        : ''
    }
${intro}

## Installation

import { PackageManagerTabs } from '@rspress/core/theme';

<PackageManagerTabs command="add ${name}${
      entry.group === 'internals' || /plugin|config|webpack/.test(entry.id)
        ? ' -D'
        : ''
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

write(
  'packages/index.mdx',
  `---
title: Packages overview
pageType: doc-wide
outline: false
---

# Packages overview

Every public package published from [lynx-stack](https://github.com/lynx-family/lynx-stack), from the build tools every Lynx app uses to the internals of the build engine. The line under a package is its main export or the command that runs it.

{/* @api PackagesOverview */}
{/* @api-end */}
`,
);
