// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rspress/core';
import { pluginClientRedirects } from '@rspress/plugin-client-redirects';
import {
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from '@shikijs/transformers';

import { syncChangelogs } from './scripts/changelogs.ts';

const root = dirname(fileURLToPath(import.meta.url));
const contentRoot = join(root, 'content');

const isCI = Boolean(process.env['CI']);
const CDN_HOST = 'lynx-family.github.io/lynx-stack';

syncChangelogs(contentRoot);

const WEBPACK_PACKAGES = [
  'chunk-loading-webpack-plugin',
  'css-extract-webpack-plugin',
  'externals-loading-webpack-plugin',
  'react-webpack-plugin',
  'runtime-wrapper-webpack-plugin',
  'template-webpack-plugin',
  'webpack-runtime-globals',
].join('|');

const API_DOCUMENTER_REDIRECTS = [
  {
    from: '^/(zh/)?api/rspeedy\\.config\\.splitchunks(\\.html)?$',
    to: '/$1config/splitChunks',
  },
  {
    from:
      '^/(zh/)?api/rspeedy\\.config\\.(environments|mode|plugins)(\\.html)?$',
    to: '/$1config/$2',
  },
  {
    from:
      '^/(zh/)?api/rspeedy\\.(dev|output|performance|resolve|server|source|tools)(\\..*)?$',
    to: '/$1config/$2',
  },
  { from: '^/(zh/)?api/rspeedy(\\..*)?$', to: '/$1packages/rspeedy' },
  {
    from: '^/(zh/)?api/react-rsbuild-plugin(\\..*)?$',
    to: '/$1plugins/plugin-react',
  },
  {
    from: '^/(zh/)?api/qrcode-rsbuild-plugin(\\..*)?$',
    to: '/$1plugins/plugin-qrcode',
  },
  {
    from: '^/(zh/)?api/external-bundle-rsbuild-plugin(\\..*)?$',
    to: '/$1plugins/plugin-external-bundle',
  },
  {
    from: '^/(zh/)?api/(config-rsbuild-plugin|type-config)(\\..*)?$',
    to: '/$1plugins/plugin-config',
  },
  {
    from: '^/(zh/)?api/lynx-bundle-rslib-config(\\..*)?$',
    to: '/$1plugins/lynx-bundle-rslib-config',
  },
  { from: `^/(zh/)?api/(${WEBPACK_PACKAGES})(\\..*)?$`, to: '/$1packages/$2' },
  { from: '^/(zh/)?api/react([./].*)?$', to: '/$1react/api/' },
  { from: '^/(zh/)?api/?$', to: '/$1packages/' },
];

const MOVED_SECTION_REDIRECTS = [
  { from: '^/(zh/)?rspeedy/config(/.*)?$', to: '/$1config$2' },
  { from: '^/(zh/)?rspeedy/plugins(/.*)?$', to: '/$1plugins$2' },
  { from: '^/(zh/)?rspeedy/api(/.*)?$', to: '/$1packages/rspeedy' },
];

const LYNXJS_GUIDES: Record<string, string> = {
  'installation': 'rspeedy/',
  'cli': 'rspeedy/cli.html',
  'typescript': 'rspeedy/typescript.html',
  'css': 'rspeedy/styling.html',
  'assets': 'rspeedy/assets.html',
  'output': 'rspeedy/output.html',
  'resolve': 'rspeedy/resolve.html',
  'plugin': 'rspeedy/plugin.html',
  'upgrade-rspeedy': 'rspeedy/upgrade.html',
  'build-profiling': 'rspeedy/build-profiling.html',
  'use-rsdoctor': 'rspeedy/use-rsdoctor.html',
  'hmr': 'rspeedy/',
  'code-splitting': 'react/code-splitting.html',
  'chunk-splitting': 'react/code-splitting.html',
  'i18n': 'guide/inclusion/internationalization.html',
  'glossary': 'guide/glossary.html',
  'compatibility': 'guide/compatibility.html',
};

const REPOSITORY = 'https://github.com/lynx-family/lynx-stack';

const REMOVED_PAGE_REDIRECTS = [
  ...Object.entries(LYNXJS_GUIDES).flatMap(([guide, target]) => [
    {
      from: `^/guide/${guide}(\\.html)?$`,
      to: `https://lynxjs.org/${target}`,
    },
    {
      from: `^/zh/guide/${guide}(\\.html)?$`,
      to: `https://lynxjs.org/zh/${target}`,
    },
  ]),
  {
    from: '^/(zh/)?guide/genui(/.*)?$',
    to: `${REPOSITORY}/tree/main/packages/genui`,
  },
  { from: '^/(zh/)?about(\\.html)?$', to: REPOSITORY },
  {
    from: '^/(zh/)?contribute(\\.html)?$',
    to: `${REPOSITORY}/blob/main/CONTRIBUTING.md`,
  },
];

export default defineConfig({
  root: contentRoot,
  llms: true,
  lang: 'en',
  title: 'Lynx Stack',
  description:
    'API reference for the Lynx build configuration, the Rsbuild plugins, ReactLynx and every @lynx-js package',
  locales: [
    { lang: 'zh', label: '简体中文' },
    { lang: 'en', label: 'English' },
  ],
  i18nSource: {
    editLinkText: {
      zh: '在 GitHub 上编辑此页',
      en: 'Edit this page on GitHub',
    },
    outlineTitle: {
      zh: '本页目录',
      en: 'On this page',
    },
    searchNoResultsText: {
      zh: '未搜索到相关结果',
      en: 'No results found',
    },
    searchPlaceholderText: {
      zh: '搜索文档',
      en: 'Search docs',
    },
    searchSuggestedQueryText: {
      zh: '可更换不同的关键字后重试',
      en: 'Try searching for different keywords',
    },
    'overview.filterNameText': {
      zh: '过滤',
      en: 'Filter',
    },
    'overview.filterPlaceholderText': {
      zh: '输入关键词',
      en: 'Enter keyword',
    },
    'overview.filterNoResultText': {
      zh: '未找到匹配的 API',
      en: 'No matching API found',
    },
  },
  markdown: {
    showLineNumbers: false,
    shiki: {
      transformers: [
        transformerNotationDiff(),
        transformerNotationFocus(),
        transformerNotationHighlight(),
      ],
    },
  },
  route: {
    cleanUrls: true,
  },
  plugins: [
    pluginClientRedirects({
      redirects: [
        { from: '^/a2ui(?:\\.html|/index\\.html|/)?$', to: '/genui' },
        ...API_DOCUMENTER_REDIRECTS,
        ...MOVED_SECTION_REDIRECTS,
        ...REMOVED_PAGE_REDIRECTS,
      ],
    }),
  ],
  themeConfig: {
    enableContentAnimation: false,
    enableScrollToTop: true,
    lastUpdated: true,
    editLink: {
      docRepoBaseUrl: `${REPOSITORY}/tree/main/docs/content`,
    },
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: REPOSITORY,
      },
    ],
    footer: {
      message: `© ${
        new Date().getFullYear()
      } Lynx Authors. All Rights Reserved.`,
    },
  },
  ssg: {
    experimentalWorker: true,
  },
  globalStyles: join(root, 'src/styles/global.scss'),
  builderConfig: {
    ...(isCI ? { output: { assetPrefix: `//${CDN_HOST}/` } } : {}),
    plugins: [pluginSass()],
  },
});
