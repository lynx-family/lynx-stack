// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from '@lynx-js/react/testing-library';

function Counter(props) {
  'use memo';
  let value = props.value;
  let a = value++;
  expect(a).toBe(props.value); // postfix
  let b = ++value;
  expect(b).toBe(props.value + 2); // previous postfix operation + prefix operation
  let c = ++value;
  expect(c).toBe(props.value + 3);
  let d = value--;
  expect(d).toBe(props.value + 3);
  let e = --value;
  expect(e).toBe(props.value + 1);
  let f = --value;
  expect(f).toBe(props.value);
  expect(value).toBe(props.value);
  return <text>{value}</text>;
}

test('use-state', async () => {
  const { asFragment, rerender } = render(<Counter value={0} />);
  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        0
      </text>
    </DocumentFragment>
  `);

  rerender(<Counter value={1} />);
  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        1
      </text>
    </DocumentFragment>
  `);
});
