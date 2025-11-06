// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

import { render, fireEvent, screen } from '@lynx-js/react/testing-library';
import { useState } from '@lynx-js/react';
// @ts-ignore
import { expectLogsAndClear, log } from './expectLogs.jsx';
import { test, expect } from 'vitest';

function Counter() {
  let [state, setState] = useState(0);
  return (
    <view>
      <Title text='Counter' />
      <text>{state}</text>
      <text data-testid='button' bindtap={() => setState(state + 1)}>
        increment
      </text>
    </view>
  );
}

function Title({ text }: { text: string }) {
  log(`rendering: ${text}`);
  return <text>{text}</text>;
}

test('use-state', async () => {
  const { asFragment } = render(<Counter />);

  if (__FORGET__) {
    expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <view>
        <text>
          Counter
        </text>
        <text>
          0
        </text>
        <text
          data-testid="button"
        >
          increment
        </text>
      </view>
    </DocumentFragment>
  `);
  } else {
    // Without React Compiler, the Counter component can be compressed to
    // a single snapshot, so there will be an extra wrapper element
    expect(asFragment()).toMatchInlineSnapshot(`
      <DocumentFragment>
        <view>
          <wrapper>
            <text>
              Counter
            </text>
          </wrapper>
          <text>
            0
          </text>
          <text
            data-testid="button"
          >
            increment
          </text>
        </view>
      </DocumentFragment>
    `);
  }

  expectLogsAndClear(['rendering: Counter']);

  fireEvent.tap(screen.getByTestId('button'));
  await screen.findByText('1');

  expectLogsAndClear(__FORGET__ ? [] : ['rendering: Counter']);
});

declare global {
  var __FORGET__: boolean;
}
