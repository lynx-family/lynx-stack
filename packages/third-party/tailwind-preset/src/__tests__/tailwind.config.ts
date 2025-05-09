// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import lynxPreset from '../lynx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  presets: [lynxPreset],
  content: [
    path.resolve(__dirname, 'test-content.tsx'),
    path.resolve(__dirname, 'styles.css'),
  ],
};
