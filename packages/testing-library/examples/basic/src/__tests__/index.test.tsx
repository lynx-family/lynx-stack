// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@lynx-js/lynx-dom-jest-matchers';
import { expect, test, vi } from 'vitest';

import { getQueriesForElement } from '@lynx-js/lynx-dom-testing-library';
import { render, waitSchedule } from '@lynx-js/react-lynx-testing-library';

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
  await waitSchedule();
  expect(cb).toBeCalledTimes(1);
  expect(cb.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "__LEPUS__: false",
      ],
    ]
  `);
  expect(elementTree.root).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <view>
        <text
          id="app-text"
        >
          <raw-text
            text="Hello World!"
          />
        </text>
      </view>
    </page>
  `);
  const {
    findByText,
  } = getQueriesForElement(elementTree.root);
  const element = await findByText('Hello World!');
  expect(element).toBeInTheElementTree();
  expect(element).toMatchInlineSnapshot(`
    <text
      id="app-text"
    >
      <raw-text
        text="Hello World!"
      />
    </text>
  `);
});
