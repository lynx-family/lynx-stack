// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@testing-library/jest-dom';
import { expect, test, vi } from 'vitest';

import { getQueriesForElement } from '@testing-library/dom';
import { render } from '@lynx-js/react-lynx-testing-library';

import { App } from '../App.jsx';

test('App', async () => {
  const cb = vi.fn();

  render(
    <App
      onMounted={() => {
        cb(`__LEPUS__: ${__LEPUS__}`);
      }}
    />,
  );
  expect(cb).toBeCalledTimes(1);
  expect(cb.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "__LEPUS__: false",
      ],
    ]
  `);
  expect(elementTree.root).toMatchInlineSnapshot(`
    <page>
      <view>
        <text
          id="app-text"
        >
          Hello World!
        </text>
      </view>
    </page>
  `);
  const {
    findByText,
  } = getQueriesForElement(elementTree.root);
  const element = await findByText('Hello World!');
  expect(element).toBeInTheDocument();
  expect(element).toMatchInlineSnapshot(`
    <text
      id="app-text"
    >
      Hello World!
    </text>
  `);
});
