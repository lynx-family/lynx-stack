// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, expect, rstest, test } from '@rstest/core';

import {
  buildGlobalPropsFromInitData,
  parseInitDataFromQuery,
} from './query.js';
import { buildOpenUIRenderUrl } from '../utils/renderUrl.js';

afterEach(() => {
  rstest.unstubAllGlobals();
});

test.each(['rawText', 'rawTextUrl'] as const)(
  'forwards the Chat library to Lynx with %s payloads',
  kind => {
    const url = buildOpenUIRenderUrl({
      openuiLibrary: 'chat',
      inlineMode: true,
      initialQueryResults: { count: 0, enabled: false, empty: null, items: [] },
      [kind]: kind === 'rawText'
        ? 'root = Card([])'
        : 'https://example.com/raw.openui',
    }, 'https://example.com/');
    rstest.stubGlobal('window', { location: new URL(url) });
    const init = parseInitDataFromQuery();
    expect(init?.openuiLibrary).toBe('chat');
    expect(buildGlobalPropsFromInitData(init)?.openuiLibrary).toBe('chat');
    expect(buildGlobalPropsFromInitData(init)).toMatchObject({
      inlineMode: true,
      initialQueryResults: { count: 0, enabled: false, empty: null, items: [] },
    });
  },
);

test('accepts explicit catalog selection in init data and ignores invalid query overrides', () => {
  const params = new URLSearchParams({
    protocol: 'openui',
    initData: JSON.stringify({ openuiLibrary: 'chat' }),
    openuiLibrary: 'unknown',
  });
  rstest.stubGlobal('window', {
    location: { search: `?${params.toString()}` },
  });
  expect(parseInitDataFromQuery()?.openuiLibrary).toBe('chat');
});
