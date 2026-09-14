// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const PACKAGE_GROUPS = [
  'build',
  'react',
  'web',
  'libraries',
  'internals',
] as const;

export type PackageGroup = typeof PACKAGE_GROUPS[number];

export interface PackageEntry {
  id: string;
  dir: string;
  entry: string | string[];
  tsconfig?: string;
  group: PackageGroup;
  main?: string;
  page?: string;
  name?: string;
  includeExternals?: boolean;
}

export const PACKAGES: PackageEntry[] = [
  {
    id: 'rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-lynx',
    entry: 'src/index.ts',
    group: 'build',
    main: 'pluginLynx',
  },
  {
    id: 'react-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-react',
    entry: 'src/index.ts',
    group: 'build',
    main: 'pluginReactLynx',
  },
  {
    id: 'vanilla-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-vanilla',
    entry: 'src/index.ts',
    group: 'build',
    main: 'pluginVanillaLynx',
  },
  {
    id: 'qrcode-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-qrcode',
    entry: 'src/index.ts',
    group: 'build',
    main: 'pluginQRCode',
  },
  {
    id: 'external-bundle-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-external-bundle',
    entry: 'src/index.ts',
    group: 'build',
    main: 'pluginExternalBundle',
  },
  {
    id: 'config-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-config',
    entry: 'src/index.ts',
    group: 'build',
    main: 'pluginLynxConfig',
    includeExternals: true,
  },
  {
    id: 'debug-metadata-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-debug-metadata',
    entry: 'src/index.ts',
    group: 'build',
    main: 'pluginLynxDebugMetadata',
  },
  {
    id: 'react-alias-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-react-alias',
    entry: 'src/index.ts',
    group: 'build',
    main: 'pluginReactAlias',
  },
  {
    id: 'lynx-bundle-rslib-config',
    dir: 'packages/rspeedy/lynx-bundle-rslib-config',
    entry: 'src/index.ts',
    group: 'build',
    main: 'defineExternalBundleRslibConfig',
  },
  {
    id: 'rspeedy',
    dir: 'packages/rspeedy/core',
    entry: 'src/index.ts',
    group: 'build',
    main: 'defineConfig',
  },

  {
    id: 'react',
    dir: 'packages/react',
    entry: 'types/react.docs.d.ts',
    group: 'react',
    page: '/react/api/',
  },
  {
    id: 'react-testing-library',
    dir: 'packages/react/testing-library',
    entry: 'types/index.d.ts',
    group: 'react',
    page: '/react/api/testing-library',
    name: '@lynx-js/react/testing-library',
  },
  {
    id: 'react-signals',
    dir: 'packages/react-signals',
    entry: 'src/index.ts',
    group: 'react',
  },
  {
    id: 'use-sync-external-store',
    dir: 'packages/use-sync-external-store',
    entry: 'index.d.ts',
    group: 'react',
  },
  {
    id: 'background-only',
    dir: 'packages/background-only',
    entry: 'index.d.ts',
    group: 'react',
  },

  {
    id: 'web-core',
    dir: 'packages/web-platform/web-core',
    entry: 'dist/client/index.d.ts',
    group: 'web',
  },
  {
    id: 'web-elements',
    dir: 'packages/web-platform/web-elements',
    entry: 'src/elements/index.ts',
    group: 'web',
  },
  {
    id: 'web-platform-rsbuild-plugin',
    dir: 'packages/web-platform/web-rsbuild-plugin',
    entry: 'src/index.ts',
    group: 'web',
    main: 'pluginWebPlatform',
  },
  {
    id: 'web-rsbuild-server-middleware',
    dir: 'packages/web-platform/web-rsbuild-server-middleware',
    entry: 'src/node/index.ts',
    group: 'web',
  },
  {
    id: 'web-explorer',
    dir: 'packages/web-platform/web-explorer',
    entry: 'index.ts',
    group: 'web',
  },
  {
    id: 'web-worker-rpc',
    dir: 'packages/web-platform/web-worker-rpc',
    entry: 'src/index.ts',
    group: 'web',
  },

  {
    id: 'tailwind-preset',
    dir: 'packages/tailwind-preset',
    entry: 'src/lynx.ts',
    group: 'libraries',
    main: 'createLynxPreset',
  },
  {
    id: 'motion',
    dir: 'packages/motion',
    entry: 'src/index.ts',
    group: 'libraries',
  },
  {
    id: 'gesture-runtime',
    dir: 'packages/lynx/gesture-runtime',
    entry: 'src/index.ts',
    group: 'libraries',
  },
  {
    id: 'websocket',
    dir: 'packages/rspeedy/websocket',
    entry: 'src/index.ts',
    group: 'libraries',
  },
  {
    id: 'genui',
    dir: 'packages/genui',
    entry: 'index.ts',
    tsconfig: 'tsconfig.build.json',
    group: 'libraries',
  },
  {
    id: 'i18next-translation-dedupe',
    dir: 'packages/i18n/i18next-translation-dedupe',
    entry: 'src/index.ts',
    group: 'libraries',
    main: 'pluginLynxI18nextTranslationDedupe',
  },
  {
    id: 'autolink-codegen',
    dir: 'packages/lynx/autolink-codegen',
    entry: 'src/index.ts',
    group: 'libraries',
  },
  {
    id: 'testing-environment',
    dir: 'packages/testing-library/testing-environment',
    entry: 'src/index.ts',
    group: 'libraries',
  },

  {
    id: 'template-webpack-plugin',
    dir: 'packages/webpack/template-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'LynxTemplatePlugin',
  },
  {
    id: 'css-extract-webpack-plugin',
    dir: 'packages/webpack/css-extract-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'CssExtractRspackPlugin',
  },
  {
    id: 'chunk-loading-webpack-plugin',
    dir: 'packages/webpack/chunk-loading-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'ChunkLoadingWebpackPlugin',
  },
  {
    id: 'runtime-wrapper-webpack-plugin',
    dir: 'packages/webpack/runtime-wrapper-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'RuntimeWrapperWebpackPlugin',
  },
  {
    id: 'react-webpack-plugin',
    dir: 'packages/webpack/react-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'ReactWebpackPlugin',
  },
  {
    id: 'react-refresh-webpack-plugin',
    dir: 'packages/webpack/react-refresh-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'ReactRefreshRspackPlugin',
  },
  {
    id: 'externals-loading-webpack-plugin',
    dir: 'packages/webpack/externals-loading-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'ExternalsLoadingPlugin',
  },
  {
    id: 'cache-events-webpack-plugin',
    dir: 'packages/webpack/cache-events-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'LynxCacheEventsPlugin',
  },
  {
    id: 'runtime-config-webpack-plugin',
    dir: 'packages/webpack/runtime-config-webpack-plugin',
    entry: 'src/index.ts',
    group: 'internals',
    main: 'RuntimeConfigWebpackPlugin',
  },
  {
    id: 'webpack-dev-transport',
    dir: 'packages/webpack/webpack-dev-transport',
    entry: 'lib/client/index.d.ts',
    group: 'internals',
  },
  {
    id: 'webpack-runtime-globals',
    dir: 'packages/webpack/webpack-runtime-globals',
    entry: 'src/index.ts',
    group: 'internals',
  },
  {
    id: 'css-serializer',
    dir: 'packages/tools/css-serializer',
    entry: 'src/index.ts',
    group: 'internals',
  },
  {
    id: 'debug-metadata',
    dir: 'packages/tools/debug-metadata',
    entry: 'src/index.ts',
    group: 'internals',
  },
];
