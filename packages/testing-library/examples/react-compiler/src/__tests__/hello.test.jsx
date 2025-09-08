// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from '@lynx-js/react/testing-library';
import { expectLogsAndClear, log } from './expectLogs';

function Hello({ name }) {
  const items = [1, 2, 3].map(item => {
    log(`recomputing ${item}`);
    return <text key={item}>Item {item}</text>;
  });
  return (
    <text>
      Hello<text>{name}</text>
      {items}
    </text>
  );
}

test('hello', () => {
  let { asFragment, rerender } = render(<Hello name='World' />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        Hello
        <text>
          World
        </text>
        <wrapper>
          <text>
            <wrapper>
              Item 1
            </wrapper>
          </text>
          <text>
            <wrapper>
              Item 2
            </wrapper>
          </text>
          <text>
            <wrapper>
              Item 3
            </wrapper>
          </text>
        </wrapper>
      </text>
    </DocumentFragment>
  `);

  expectLogsAndClear(['recomputing 1', 'recomputing 2', 'recomputing 3']);

  rerender(<Hello name='Universe' />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        Hello
        <text>
          Universe
        </text>
        <wrapper>
          <text>
            <wrapper>
              Item 1
            </wrapper>
          </text>
          <text>
            <wrapper>
              Item 2
            </wrapper>
          </text>
          <text>
            <wrapper>
              Item 3
            </wrapper>
          </text>
        </wrapper>
      </text>
    </DocumentFragment>
  `);

  expectLogsAndClear(
    __FORGET__ ? [] : ['recomputing 1', 'recomputing 2', 'recomputing 3'],
  );
});
