// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable n/no-unsupported-features/node-builtins -- Web fetch responses are available in the repository Node.js test runtime. */
import { afterEach, expect, rstest, test } from '@rstest/core';

import { loadOpenUIResponse } from '../../lynx-src/openui/source.js';

afterEach(() => {
  rstest.unstubAllGlobals();
});

test('native source loading resolves packaged assets against the deployment path', async () => {
  rstest.stubGlobal(
    'fetch',
    rstest.fn(async () =>
      new Response(
        'root = Card([ImageText("./demos/openui/chat/assets/place.png", "Place", "Trip")])',
      )
    ),
  );
  expect(
    await loadOpenUIResponse(
      'https://example.com/genui/demos/openui/chat/six-day-trip.openui',
    ),
  ).toContain('https://example.com/genui/demos/openui/chat/assets/place.png');
});

test('surfaces source fetch failures instead of rendering a different fallback example', async () => {
  rstest.stubGlobal(
    'fetch',
    rstest.fn(async () => new Response('Missing source', { status: 404 })),
  );
  await expect(loadOpenUIResponse('https://example.com/missing.openui')).rejects
    .toThrow('Unable to load OpenUI source (404)');
});
