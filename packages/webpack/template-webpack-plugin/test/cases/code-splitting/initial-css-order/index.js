/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// entry-main imports common -> feature-b -> feature-a, so the merged .shared
// rules should keep green -> blue -> red even after splitChunks extraction.
import './entry-main.js';

it('should preserve source css order across shared and split initial chunks', async () => {
  const tasmJSONPath = resolve(__dirname, '.rspeedy/main/tasm.json');
  expect(existsSync(tasmJSONPath)).toBeTruthy();

  const content = await readFile(tasmJSONPath, 'utf-8');
  const { css } = JSON.parse(content);

  const sharedRules = Object.values(css.cssMap)
    .flat()
    .filter((rule) =>
      rule.type === 'StyleRule' && rule.selectorText?.value === '.shared'
    );
  const sharedColors = sharedRules.map((rule) => {
    const colorDeclaration = rule.style.find(
      (property) => property.name === 'color',
    );
    return colorDeclaration?.value;
  });

  expect(sharedRules).toHaveLength(3);
  expect(sharedColors).toEqual(['green', 'blue', 'red']);
});
