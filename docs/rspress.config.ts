// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rspress/core';

import { pluginApiReference } from './plugins/index.ts';

export default defineConfig({
  root: join(dirname(fileURLToPath(import.meta.url)), 'content'),
  lang: 'en',
  title: 'Lynx Stack',
  description: 'The API reference of the lynx-stack packages',
  locales: [
    { lang: 'en', label: 'English' },
    { lang: 'zh', label: '简体中文' },
  ],
  route: {
    cleanUrls: true,
  },
  builderConfig: {
    server: {
      open: '/api/react/',
    },
  },
  plugins: pluginApiReference(),
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/lynx-family/lynx-stack',
      },
    ],
  },
});
