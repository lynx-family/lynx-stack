// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from '@lynx-js/react/testing-library';

globalThis.constantValue = 'global test value';

test('literal-constant-propagation', () => {
  function Component() {
    'use memo';
    const x = 'test value 1';
    return <text>{x}</text>;
  }
  const { asFragment, rerender } = render(<Component />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        test value 1
      </text>
    </DocumentFragment>
  `);

  rerender(<Component />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        test value 1
      </text>
    </DocumentFragment>
  `);
});

test('global-constant-propagation', () => {
  function Component() {
    'use memo';
    const x = constantValue;

    return <text>{x}</text>;
  }
  const { asFragment, rerender } = render(<Component />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        global test value
      </text>
    </DocumentFragment>
  `);

  rerender(<Component />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        global test value
      </text>
    </DocumentFragment>
  `);
});

test('lambda-constant-propagation', () => {
  function Component() {
    'use memo';
    const x = 'test value 1';
    const getText = () => <text>{x}</text>;
    return getText();
  }
  const { asFragment, rerender } = render(<Component />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        test value 1
      </text>
    </DocumentFragment>
  `);

  rerender(<Component />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        test value 1
      </text>
    </DocumentFragment>
  `);
});

test('lambda-constant-propagation-of-phi-node', () => {
  function Component({ noopCallback }) {
    'use memo';
    const x = 'test value 1';
    if (constantValue) {
      noopCallback();
    }
    for (let i = 0; i < 5; i++) {
      if (!constantValue) {
        noopCallback();
      }
    }
    const getText = () => <text>{x}</text>;
    return getText();
  }

  const { asFragment, rerender } = render(
    <Component noopCallback={() => {}} />,
  );

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        test value 1
      </text>
    </DocumentFragment>
  `);

  rerender(<Component noopCallback={() => {}} />);

  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text>
        test value 1
      </text>
    </DocumentFragment>
  `);
});
