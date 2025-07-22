// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from '@lynx-js/react/testing-library';

function Button({ label }) {
  const theme = useTheme();
  const style = computeStyle(theme);
  return <text color={style}>{label}</text>;
}

let currentTheme = 'light';
function useTheme() {
  'use memo';
  return currentTheme;
}

let styleComputations = 0;
function computeStyle(theme) {
  styleComputations++;
  return theme === 'light' ? 'white' : 'black';
}

test('update-button', () => {
  const { asFragment, rerender } = render(<Button label='Click me' />);
  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text
        color="white"
      >
        Click me
      </text>
    </DocumentFragment>
  `);

  // Update the label, but not the theme
  rerender(<Button label='Click again' />);
  // `computeStyle` should not be called again when Forget is enabled
  expect(styleComputations).toBe(__FORGET__ ? 1 : 2);
  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text
        color="white"
      >
        Click again
      </text>
    </DocumentFragment>
  `);

  currentTheme = 'dark';
  rerender(<Button label='Click again' />);
  expect(asFragment()).toMatchInlineSnapshot(`
    <DocumentFragment>
      <text
        color="black"
      >
        Click again
      </text>
    </DocumentFragment>
  `);

  expect(styleComputations).toBe(__FORGET__ ? 2 : 3);
});
