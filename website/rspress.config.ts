// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import { join } from 'node:path';

import { pluginSass } from '@rsbuild/plugin-sass';
import type { Sidebar } from '@rspress/shared';
import {
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from '@shikijs/transformers';
import { defineConfig } from 'rspress/config';

import { createAPI, createChangelogs } from './sidebars/index.js';

const isDev = process.env['NODE_ENV'] === 'development';

const CDN_HOST = 'lynx-family.github.io/lynx-stack';

const SIDEBARS = {
  React: [
    {
      sectionHeaderText: 'React Framework API',
    },
    {
      dividerType: 'solid',
    },
    createAPI({
      name: 'react',
      skips: [
        'Root',
      ],
      text: '@lynx-js/react',
    }),
  ],
  Rspeedy: [
    {
      sectionHeaderText: 'Rspeedy Plugins API',
    },
    {
      dividerType: 'solid',
    },
    createAPI({
      name: 'react-rsbuild-plugin',
      skips: [
        // Transform options
        'AddComponentElementConfig',
        'CompatVisitorConfig',
        'DefineDceVisitorConfig',
        'ExtractStrConfig',
        'JsxTransformerConfig',
        'ShakeVisitorConfig',

        'PluginReactLynxOptions',
      ],
    }),
    createAPI({
      name: 'qrcode-rsbuild-plugin',
      skips: [
        'PluginQRCodeOptions',
      ],
    }),
  ],
  Webpack: [
    {
      sectionHeaderText: 'Webpack Plugins API',
    },
    {
      dividerType: 'solid',
    },
    createAPI({ name: 'chunk-loading-webpack-plugin' }),
    createAPI({ name: 'css-extract-webpack-plugin' }),
    createAPI({ name: 'react-webpack-plugin' }),
    createAPI({ name: 'runtime-wrapper-webpack-plugin' }),
    createAPI({ name: 'template-webpack-plugin' }),
    createAPI({ name: 'webpack-runtime-globals' }),
  ],
  Config: [
    {
      sectionHeaderText: 'Rspeedy Configuration',
    },
    {
      dividerType: 'solid',
    },
    {
      link: '/api/rspeedy.config.environments',
      text: 'Environments',
      collapsible: false,
    },
    {
      link: '/api/rspeedy.config.mode',
      text: 'Mode',
      collapsible: false,
    },
    ...createAPI({
      text: 'Config',
      base: 'api',
      name: 'rspeedy',
      skips: [
        // Skip the whole object
        'Config',

        // Sub Configurations
        'BuildCache',
        'ChunkSplit',
        'ChunkSplitBySize',
        'ChunkSplitCustom',
        'ConsoleType',
        'CssExtract',
        'CssExtractRspackLoaderOptions',
        'CssExtractRspackPluginOptions',
        'CssLoader',
        'CssLoaderModules',
        'CssModules',
        'CssModuleLocalsConvention',
        'Decorators',
        'DevClient',
        'DistPath',
        'Filename',
        'Minify',
        'Entry',
        'EntryDescription',
        'RsdoctorRspackPluginOptions',
        'SourceMap',
        'TransformImport',

        // APIs
        'createRspeedy',
        'CreateRspeedyOptions',
        'RspeedyInstance',
        'defineConfig',
        'loadConfig',
        'LoadConfigOptions',
        'LoadConfigResult',
        'ExposedAPI',
        'mergeRspeedyConfig',

        // version
        'version',
        'rspackVersion',
      ],
      collapsed: true,
      depth: 3,
    }).items as Sidebar[string],
  ],
} satisfies Sidebar;

const SIDEBARS_ZH = {
  React: [
    {
      sectionHeaderText: 'React 框架 API',
    },
    {
      dividerType: 'solid',
    },
    createAPI({
      base: 'zh/api',
      name: 'react',
      skips: [
        'Root',
      ],
      text: '@lynx-js/react',
    }),
  ],
  Rspeedy: [
    {
      sectionHeaderText: 'Rspeedy 插件 API',
    },
    {
      dividerType: 'solid',
    },
    createAPI({
      base: 'zh/api',
      name: 'react-rsbuild-plugin',
      skips: [
        // Transform options
        'AddComponentElementConfig',
        'CompatVisitorConfig',
        'DefineDceVisitorConfig',
        'ExtractStrConfig',
        'JsxTransformerConfig',
        'ShakeVisitorConfig',

        'PluginReactLynxOptions',
      ],
    }),
    createAPI({
      base: 'zh/api',
      name: 'qrcode-rsbuild-plugin',
      skips: [
        'PluginQRCodeOptions',
      ],
    }),
  ],
  Webpack: [
    {
      sectionHeaderText: 'Webpack 插件 API',
    },
    {
      dividerType: 'solid',
    },
    createAPI({ base: 'zh/api', name: 'chunk-loading-webpack-plugin' }),
    createAPI({ base: 'zh/api', name: 'css-extract-webpack-plugin' }),
    createAPI({ base: 'zh/api', name: 'react-webpack-plugin' }),
    createAPI({ base: 'zh/api', name: 'runtime-wrapper-webpack-plugin' }),
    createAPI({ base: 'zh/api', name: 'template-webpack-plugin' }),
    createAPI({ base: 'zh/api', name: 'webpack-runtime-globals' }),
  ],
  Config: [
    {
      sectionHeaderText: 'Rspeedy 配置',
    },
    {
      dividerType: 'solid',
    },
    {
      link: '/zh/api/rspeedy.config.environments',
      text: 'Environments',
      collapsible: false,
    },
    {
      link: '/zh/api/rspeedy.config.mode',
      text: 'Mode',
      collapsible: false,
    },
    ...createAPI({
      text: 'Config',
      base: 'zh/api',
      name: 'rspeedy',
      skips: [
        // Skip the whole object
        'Config',

        // Sub Configurations
        'BuildCache',
        'ChunkSplit',
        'ChunkSplitBySize',
        'ChunkSplitCustom',
        'ConsoleType',
        'CssExtract',
        'CssExtractRspackLoaderOptions',
        'CssExtractRspackPluginOptions',
        'CssLoader',
        'CssLoaderModules',
        'CssModules',
        'CssModuleLocalsConvention',
        'Decorators',
        'DevClient',
        'DistPath',
        'Filename',
        'Minify',
        'Entry',
        'EntryDescription',
        'RsdoctorRspackPluginOptions',
        'SourceMap',
        'TransformImport',

        // APIs
        'createRspeedy',
        'CreateRspeedyOptions',
        'RspeedyInstance',
        'defineConfig',
        'loadConfig',
        'LoadConfigOptions',
        'LoadConfigResult',
        'ExposedAPI',
        'mergeRspeedyConfig',

        // version
        'version',
        'rspackVersion',
      ],
      collapsed: true,
      depth: 3,
    }).items as Sidebar[string],
  ],
} satisfies Sidebar;

fs.rmSync(
  join(__dirname, 'docs/en/changelog'),
  { recursive: true, force: true },
);

fs.rmSync(
  join(__dirname, 'docs/zh/changelog'),
  { recursive: true, force: true },
);

const CHANGELOG = {
  react: createChangelogs(
    'React CHANGELOG',
    [
      '@lynx-js/react',
    ],
  ),
  rspeedy: createChangelogs(
    'Rspeedy CHANGELOG',
    [
      '@lynx-js/rspeedy',
      '@lynx-js/react-rsbuild-plugin',
      '@lynx-js/qrcode-rsbuild-plugin',
    ],
  ),
  webpack: createChangelogs(
    'Webpack Plugins CHANGELOG',
    [
      '@lynx-js/chunk-loading-webpack-plugin',
      '@lynx-js/css-extract-webpack-plugin',
      '@lynx-js/react-webpack-plugin',
      '@lynx-js/runtime-wrapper-webpack-plugin',
      '@lynx-js/template-webpack-plugin',
    ],
  ),
};

const CHANGELOG_ZH = {
  react: createChangelogs(
    'React CHANGELOG',
    [
      '@lynx-js/react',
    ],
    'zh',
  ),
  rspeedy: createChangelogs(
    'Rspeedy CHANGELOG',
    [
      '@lynx-js/rspeedy',
      '@lynx-js/react-rsbuild-plugin',
      '@lynx-js/qrcode-rsbuild-plugin',
    ],
    'zh',
  ),
  webpack: createChangelogs(
    'Webpack Plugins CHANGELOG',
    [
      '@lynx-js/chunk-loading-webpack-plugin',
      '@lynx-js/css-extract-webpack-plugin',
      '@lynx-js/react-webpack-plugin',
      '@lynx-js/runtime-wrapper-webpack-plugin',
      '@lynx-js/template-webpack-plugin',
    ],
    'zh',
  ),
};

export default defineConfig({
  root: 'docs',
  lang: 'en',
  title: 'Lynx Stack',
  description: 'A collection of tools for building Lynx applications',
  logo: {
    light: isDev
      ? '/rspeedy-navbar-logo.png'
      : `https://${CDN_HOST}/rspeedy-navbar-logo.png`,
    dark: isDev
      ? '/rspeedy-navbar-logo-dark.png'
      : `https://${CDN_HOST}/rspeedy-navbar-logo-dark.png`,
  },
  icon: '/rspeedy.png',
  markdown: {
    checkDeadLinks: true,
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
  themeConfig: {
    locales: [
      {
        lang: 'zh',
        label: '简体中文',
        title: 'Rspeedy',
        description: '由 Rspack 驱动的 Lynx 构建工具',
        editLink: {
          docRepoBaseUrl:
            'https://github.com/lynx-family/lynx-stack/tree/main/website/docs',
          text: '📝 在 GitHub 上编辑此页',
        },
        searchNoResultsText: '未搜索到相关结果',
        searchPlaceholderText: '搜索文档',
        searchSuggestedQueryText: '可更换不同的关键字后重试',
        overview: {
          filterNameText: '过滤',
          filterPlaceholderText: '输入关键词',
          filterNoResultText: '未找到匹配的 API',
        },
      },
      {
        lang: 'en',
        label: 'English',
        title: 'Rspeedy',
        description: 'Fast Rspack-based Lynx build tools',
        editLink: {
          docRepoBaseUrl:
            'https://github.com/lynx-family/lynx-stack/tree/main/website/docs',
          text: '📝 Edit this page on GitHub',
        },
      },
    ],
    lastUpdated: true,
    socialLinks: [
      {
        icon: 'github',
        content: 'https://github.com/lynx-family/lynx-stack',
        mode: 'link',
      },
    ],
    footer: {
      // Footer text
      message: `© ${
        new Date().getFullYear()
      } Lynx Authors. All Rights Reserved.`,
    },
    sidebar: {
      '/about': [
        {
          sectionHeaderText: 'About Lynx Stack',
        },
        {
          dividerType: 'solid',
        },
        {
          text: 'Overview',
          link: '/about',
        },
        {
          text: 'Contribute',
          link: '/contribute',
        },
        {
          dividerType: 'solid',
        },
        {
          text: 'Get Started',
          link: '/guide/installation',
        },
      ],
      '/zh/about': [
        {
          sectionHeaderText: '关于 Lynx Stack',
        },
        {
          dividerType: 'solid',
        },
        {
          text: '概览',
          link: '/zh/about',
        },
        {
          text: '贡献',
          link: '/zh/contribute',
        },
        {
          dividerType: 'solid',
        },
        {
          text: '快速开始',
          link: '/zh/guide/installation',
        },
      ],

      // Config
      '/api/rspeedy': SIDEBARS.Config,
      '/zh/api/rspeedy': SIDEBARS_ZH.Config,

      // API
      ...(Object.fromEntries(
        [
          SIDEBARS.Rspeedy,
          SIDEBARS.React,
          SIDEBARS.Webpack,
          CHANGELOG.react.sidebar,
          CHANGELOG.rspeedy.sidebar,
          CHANGELOG.webpack.sidebar,
        ]
          .flatMap(sidebar =>
            Object.values(sidebar.map(api => {
              if ('link' in api) {
                return [api.link, sidebar] as [string, Sidebar[string]];
              }
              return null;
            })).filter(i => i !== null)
          ),
      )),

      // API
      ...(Object.fromEntries(
        [
          SIDEBARS_ZH.Rspeedy,
          SIDEBARS_ZH.React,
          SIDEBARS_ZH.Webpack,
          CHANGELOG_ZH.react.sidebar,
          CHANGELOG_ZH.rspeedy.sidebar,
          CHANGELOG_ZH.webpack.sidebar,
        ]
          .flatMap(sidebar =>
            Object.values(sidebar.map(api => {
              if ('link' in api) {
                return [api.link, sidebar] as [string, Sidebar[string]];
              }
              return null;
            })).filter(i => i !== null)
          ),
      )),

      '/guide/': [
        {
          sectionHeaderText: 'Rspeedy Guide',
        },
        {
          dividerType: 'solid',
        },
        {
          'text': 'Getting Started',
          items: [
            '/guide/installation',
            // '/guide/glossary',
          ],
        },
        {
          text: 'Features',
          items: [
            '/guide/cli',
            // '/guide/hmr',
            '/guide/typescript',
            '/guide/css',
            '/guide/assets',
            '/guide/output',
            '/guide/resolve',
            '/guide/i18n',
            '/guide/plugin',
            '/guide/code-splitting',
            // '/guide/compatibility',
            '/guide/upgrade-rspeedy',
          ],
        },
        {
          text: 'Debug',
          items: [
            '/guide/build-profiling',
            '/guide/use-rsdoctor',
          ],
        },
      ],
      '/zh/guide/': [
        {
          sectionHeaderText: 'Rspeedy 指南',
        },
        {
          dividerType: 'solid',
        },
        {
          'text': '入门',
          items: [
            '/zh/guide/installation',
            // '/guide/glossary',
          ],
        },
        {
          text: '特性',
          items: [
            '/zh/guide/cli',
            // '/guide/hmr',
            '/zh/guide/typescript',
            '/zh/guide/css',
            '/zh/guide/assets',
            '/zh/guide/output',
            '/zh/guide/resolve',
            '/guide/i18n',
            '/zh/guide/plugin',
            '/zh/guide/code-splitting',
            // '/guide/compatibility',
            '/zh/guide/upgrade-rspeedy',
          ],
        },
        {
          text: '调试',
          items: [
            '/zh/guide/build-profiling',
            '/zh/guide/use-rsdoctor',
          ],
        },
      ],
    },
    nav: [
      {
        text: 'Guide',
        link: '/guide/installation',
      },
      {
        text: 'API',
        items: [
          {
            text: 'Rspeedy Config',
            link: '/api/rspeedy',
          },
          {
            text: 'React',
            link: '/api/react/',
          },
          {
            text: 'Rspeedy Plugins',
            link: '/api/react-rsbuild-plugin',
          },
          {
            text: 'Webpack Plugins',
            link: '/api/template-webpack-plugin',
          },
        ],
      },
      {
        text: 'CHANGELOG',
        items: [
          {
            text: 'React',
            link: '/changelog/lynx-js--react',
          },
          {
            text: 'Rspeedy',
            link: '/changelog/lynx-js--rspeedy',
          },
          {
            text: 'Webpack',
            link: '/changelog/lynx-js--react-webpack-plugin',
          },
        ],
      },
      {
        text: 'About',
        items: [
          {
            text: 'Overview',
            link: '/about',
          },
          {
            text: 'Contribute',
            link: '/contribute',
          },
        ],
      },
    ],
    enableScrollToTop: true,
  },
  ssg: true,
  // We use GitHub Pages to host the website, so we need to set the base path to `/lynx-stack/`
  base: '/lynx-stack/',
  globalStyles: join(__dirname, 'src', 'styles', 'global.scss'),
  builderConfig: {
    output: {
      assetPrefix: `//${CDN_HOST}/`,
    },
    server: {
      open: 'http://localhost:<port>/lynx-stack/',
    },
    source: {
      alias: {
        '@site': __dirname,
        '@components': join(__dirname, 'src', 'components'),
      },
    },
    plugins: [
      pluginSass(),
    ],
  },
});
