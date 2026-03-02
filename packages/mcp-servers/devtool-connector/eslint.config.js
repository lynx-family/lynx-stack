// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import headers from 'eslint-plugin-headers';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '.rslib/**',
    'dist/**',
    'node_modules/**',
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          allowDefaultProject: ['*.js', 'rslib.config.ts'],
          defaultProject: './tsconfig.json',
        },
      },
    },
  },
  {
    plugins: {
      headers,
    },
    rules: {
      'headers/header-format': [
        'error',
        {
          source: 'string',
          style: 'line',
          content: [
            'Copyright (year) {authors}. All rights reserved.',
            'Licensed under the (license) that can be found in the',
            'LICENSE file in the root directory of this source tree.',
          ].join('\n'),
          variables: {
            authors: 'The Lynx Authors',
          },
          patterns: {
            year: {
              pattern: '\\d{4}',
              defaultValue: new Date().getFullYear().toString(),
            },
            license: {
              pattern: [
                'Apache License Version 2.0',
              ].join('|'),
              defaultValue: 'Apache License Version 2.0',
            },
          },
        },
      ],
    },
  },
);
