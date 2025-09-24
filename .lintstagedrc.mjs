// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const fix = {
  '*.{ts,tsx,js,jsx,cjs,mjs,css,sass,scss,less,html,yml,yaml,rs,toml,md,json}':
    [
      // 'eslint --cache --fix --no-warn-ignored',
      'biome lint --write --no-errors-on-unmatched --files-ignore-unknown=true',
      'dprint fmt --allow-no-files --',
    ],
  '*.rs': [
    'cargo fmt --',
  ],
  'package.json': 'sort-package-json',
};

export default fix;
