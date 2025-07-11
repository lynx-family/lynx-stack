// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

import parser from '@typescript-eslint/parser';
import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';

import jsConfig from './index.js';

const configs: Linter.Config<Linter.RulesRecord>[] = defineConfig([
  ...jsConfig,
  {
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
    },
  },
]);

export default configs;
