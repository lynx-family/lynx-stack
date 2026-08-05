// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import OpenUIAgentService from '../service/openui-agent.js';

describe('OpenUIAgentService', () => {
  test('awaits generate before extracting the OpenUI text', async () => {
    const service = new OpenUIAgentService(() => ({
      agent: {
        generate: () =>
          Promise.resolve({
            finishReason: 'stop',
            text: 'root = Text("OpenUI Bench", "h2")',
            usage: { totalTokens: 42 },
          }),
        stream: () => ({}),
      },
    }));

    await expect(
      service.generateRaw([
        { role: 'user', content: 'Create an OpenUI card.' },
      ]),
    ).resolves.toEqual({
      finishReason: 'stop',
      text: 'root = Text("OpenUI Bench", "h2")',
      usage: { totalTokens: 42 },
    });
  });
});
