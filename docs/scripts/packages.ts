// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface PackageEntry {
  id: string;
  dir: string;
  entry: string | string[];
  tsconfig?: string;
  section: 'rspeedy' | 'react' | 'packages';
  internal?: boolean;
}

export const PACKAGES: PackageEntry[] = [
  {
    id: 'rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-lynx',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'rspeedy',
    dir: 'packages/rspeedy/core',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'react-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-react',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'qrcode-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-qrcode',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'external-bundle-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-external-bundle',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'vanilla-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-vanilla',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'config-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-config',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'debug-metadata-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-debug-metadata',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'react-alias-rsbuild-plugin',
    dir: 'packages/rspeedy/plugin-react-alias',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'lynx-bundle-rslib-config',
    dir: 'packages/rspeedy/lynx-bundle-rslib-config',
    entry: 'src/index.ts',
    section: 'rspeedy',
  },
  {
    id: 'websocket',
    dir: 'packages/rspeedy/websocket',
    entry: 'src/index.ts',
    section: 'packages',
  },

  {
    id: 'react',
    dir: 'packages/react',
    entry: 'types/react.docs.d.ts',
    section: 'react',
  },
  {
    id: 'react-testing-library',
    dir: 'packages/react/testing-library',
    entry: 'types/index.d.ts',
    section: 'react',
  },
  {
    id: 'testing-environment',
    dir: 'packages/testing-library/testing-environment',
    entry: 'src/index.ts',
    section: 'packages',
  },

  {
    id: 'web-core',
    dir: 'packages/web-platform/web-core',
    entry: 'dist/client/index.d.ts',
    section: 'packages',
  },
  {
    id: 'web-elements',
    dir: 'packages/web-platform/web-elements',
    entry: 'src/elements/index.ts',
    section: 'packages',
  },
  {
    id: 'web-platform-rsbuild-plugin',
    dir: 'packages/web-platform/web-rsbuild-plugin',
    entry: 'src/index.ts',
    section: 'packages',
  },
  {
    id: 'web-rsbuild-server-middleware',
    dir: 'packages/web-platform/web-rsbuild-server-middleware',
    entry: 'src/node/index.ts',
    section: 'packages',
  },
  {
    id: 'web-worker-rpc',
    dir: 'packages/web-platform/web-worker-rpc',
    entry: 'src/index.ts',
    section: 'packages',
  },
  {
    id: 'web-explorer',
    dir: 'packages/web-platform/web-explorer',
    entry: 'index.ts',
    section: 'packages',
  },

  {
    id: 'template-webpack-plugin',
    dir: 'packages/webpack/template-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'css-extract-webpack-plugin',
    dir: 'packages/webpack/css-extract-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'chunk-loading-webpack-plugin',
    dir: 'packages/webpack/chunk-loading-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'runtime-wrapper-webpack-plugin',
    dir: 'packages/webpack/runtime-wrapper-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'react-webpack-plugin',
    dir: 'packages/webpack/react-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'react-refresh-webpack-plugin',
    dir: 'packages/webpack/react-refresh-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'externals-loading-webpack-plugin',
    dir: 'packages/webpack/externals-loading-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'cache-events-webpack-plugin',
    dir: 'packages/webpack/cache-events-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'runtime-config-webpack-plugin',
    dir: 'packages/webpack/runtime-config-webpack-plugin',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'webpack-dev-transport',
    dir: 'packages/webpack/webpack-dev-transport',
    entry: 'lib/client/index.d.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'webpack-runtime-globals',
    dir: 'packages/webpack/webpack-runtime-globals',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },

  {
    id: 'motion',
    dir: 'packages/motion',
    entry: 'src/index.ts',
    section: 'packages',
  },
  {
    id: 'react-signals',
    dir: 'packages/react-signals',
    entry: 'src/index.ts',
    section: 'packages',
  },
  {
    id: 'use-sync-external-store',
    dir: 'packages/use-sync-external-store',
    entry: 'index.d.ts',
    section: 'packages',
  },
  {
    id: 'tailwind-preset',
    dir: 'packages/tailwind-preset',
    entry: 'src/lynx.ts',
    section: 'packages',
  },
  {
    id: 'gesture-runtime',
    dir: 'packages/lynx/gesture-runtime',
    entry: 'src/index.ts',
    section: 'packages',
  },
  {
    id: 'autolink-codegen',
    dir: 'packages/lynx/autolink-codegen',
    entry: 'src/index.ts',
    section: 'packages',
  },
  {
    id: 'background-only',
    dir: 'packages/background-only',
    entry: 'index.d.ts',
    section: 'packages',
  },
  {
    id: 'i18next-translation-dedupe',
    dir: 'packages/i18n/i18next-translation-dedupe',
    entry: 'src/index.ts',
    section: 'packages',
  },
  {
    id: 'css-serializer',
    dir: 'packages/tools/css-serializer',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'debug-metadata',
    dir: 'packages/tools/debug-metadata',
    entry: 'src/index.ts',
    section: 'packages',
    internal: true,
  },
  {
    id: 'genui',
    dir: 'packages/genui',
    entry: 'index.ts',
    tsconfig: 'tsconfig.build.json',
    section: 'packages',
  },
];
