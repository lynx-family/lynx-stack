// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@testing-library/jest-dom';
import { expect, test, vi } from 'vitest';
import { render, getQueriesForElement } from '@lynx-js/react/testing-library';
// @ts-expect-error preact is aliased to the dep of @lynx-js/react
import { Component as PreacComponent } from 'preact';
import { Component } from '@lynx-js/react';

import { App } from '../App.jsx';

test('App', async () => {
  const cb = vi.fn();

  render(
    <App
      onMounted={() => {
        cb(`__MAIN_THREAD__: ${__MAIN_THREAD__}`);
      }}
    />,
  );
  expect(cb).toBeCalledTimes(1);
  expect(cb.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "__MAIN_THREAD__: false",
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
  } = getQueriesForElement(elementTree.root!);
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

test('preact is aliased correctly', () => {
  expect(PreacComponent).toBe(Component);
});
