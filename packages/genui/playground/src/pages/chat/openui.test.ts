// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { OPENUI_CHAT_ADAPTER } from './openui.js';
import { readOpenUILiveResponse } from '../../../lynx-src/openui/liveResponse.js';

test.each([OPENUI_CHAT_ADAPTER.stream, OPENUI_CHAT_ADAPTER.action.stream])(
  'renders cumulative partials and only completes after done for create and actions',
  stream => {
    const reduce = stream.reduce.bind(stream);
    const first = reduce(stream.initial(), {
      event: 'delta',
      data: { text: 'root = Text("实' },
    });
    const second = reduce(first.state, {
      event: 'delta',
      data: { text: '时输出")' },
    });
    const output = { rawText: 'root = Text("实时输出")', isStreaming: true };
    const partial = second.emissions.find(emission =>
      emission.type === 'partial'
    );
    expect(partial?.type === 'partial' ? partial.output : null).toMatchObject(
      output,
    );
    expect(stream.finish(second.state)).toBeNull();
    const final = reduce(second.state, {
      event: 'done',
      data: { text: 'root = Text("最终输出")' },
    });
    const finalOutput = stream.finish(final.state)!;
    expect(
      readOpenUILiveResponse(
        OPENUI_CHAT_ADAPTER.preview.livePayload(finalOutput),
      ),
    ).toEqual({
      rawText: 'root = Text("最终输出")',
      isStreaming: false,
    });
  },
);

test('rejects malformed live snapshots and accepts the empty streaming bootstrap', () => {
  expect(readOpenUILiveResponse([{ rawText: '', isStreaming: true }])).toEqual({
    rawText: '',
    isStreaming: true,
  });
  for (
    const value of [null, {}, [], [{ rawText: 'text' }], [{
      rawText: 12,
      isStreaming: true,
    }]]
  ) {
    expect(readOpenUILiveResponse(value)).toBeNull();
  }
});
