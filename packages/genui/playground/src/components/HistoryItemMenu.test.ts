// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { HistoryItemMenu } from './HistoryItemMenu.js';
import { Copy, Pencil, Trash2 } from './Icon.js';

let container: HTMLDivElement;
let root: Root;
const select = rstest.fn();

beforeEach(() => {
  rstest.stubGlobal('React', React);
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  select.mockClear();
});

afterEach(async () => {
  await React.act(async () => root.unmount());
  container.remove();
  rstest.unstubAllGlobals();
});

async function render(disabled = false) {
  await React.act(async () =>
    root.render(React.createElement(HistoryItemMenu, {
      title: 'Saved plan',
      disabled,
      actions: [
        { label: 'Rename', icon: Pencil, onSelect: select },
        { label: 'Copy', icon: Copy, onSelect: select, disabled: true },
        { label: 'Delete', icon: Trash2, onSelect: select, danger: true },
      ],
    }))
  );
  return container.querySelector('button')!;
}

async function key(target: Element, value: string) {
  await React.act(async () =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    )
  );
}

test('opens in a portal, skips disabled actions with the keyboard, and restores focus on escape and selection', async () => {
  const trigger = await render();
  trigger.focus();
  await key(trigger, 'ArrowUp');
  const menu = document.querySelector('[role="menu"]')!;
  expect(container.contains(menu)).toBe(false);
  expect(document.activeElement?.textContent).toBe('Delete');
  await key(document.activeElement!, 'ArrowDown');
  expect(document.activeElement?.textContent).toBe('Rename');
  await key(document.activeElement!, 'ArrowDown');
  expect(document.activeElement?.textContent).toBe('Delete');
  await key(document.activeElement!, 'Home');
  expect(document.activeElement?.textContent).toBe('Rename');
  await key(document.activeElement!, 'Escape');
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(select).not.toHaveBeenCalled();

  await React.act(async () => trigger.click());
  await React.act(async () =>
    (document.activeElement as HTMLButtonElement).click()
  );
  expect(select).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test('dismisses on outside interaction, scrolling, and disabling without running an action', async () => {
  const trigger = await render();
  await React.act(async () => trigger.click());
  await React.act(async () =>
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  );
  expect(document.querySelector('[role="menu"]')).toBeNull();
  await React.act(async () => trigger.click());
  await React.act(async () => container.dispatchEvent(new Event('scroll')));
  expect(document.querySelector('[role="menu"]')).toBeNull();
  await React.act(async () => trigger.click());
  await render(true);
  expect(document.querySelector('[role="menu"]')).toBeNull();
  await render(false);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(select).not.toHaveBeenCalled();
});
