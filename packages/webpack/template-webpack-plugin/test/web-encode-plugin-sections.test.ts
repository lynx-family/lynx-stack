// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { routeSections } from '../src/WebEncodePlugin.js';

describe('WebEncodePlugin: routes the sections of a bundle without a root', () => {
  test('the main thread rides lepusCode and the background the manifest', () => {
    const { lepusCode, manifest, customSections } = routeSections({
      'utils__main-thread': { encoding: 'JsBytecode', content: 'mts source' },
      utils: { content: 'bts source' },
    });

    expect(lepusCode).toStrictEqual({ 'utils__main-thread': 'mts source' });
    // `readScript` looks a background chunk up by path, the way a card carries
    // its own `/app-service.js`.
    expect(manifest).toStrictEqual({ '/utils': 'bts source' });
    expect(customSections).toStrictEqual({});
  });

  test('the styles ride the StyleInfo section under numeric ids', () => {
    const { styleInfo, lepusCode, manifest } = routeSections({
      'utils:CSS': { encoding: 'CSS', content: { ruleList: [] } },
    });

    expect(styleInfo).toStrictEqual({ 0: [] });
    expect(lepusCode).toStrictEqual({});
    expect(manifest).toStrictEqual({});
  });
});
