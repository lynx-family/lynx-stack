// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';

import { useState } from '@lynx-js/react';

import { render } from '..';
import { __root } from '../../../runtime/lib/root.js';

let setOuterKeys;

function Row({ text }) {
  return <text>{text}</text>;
}

function App() {
  const [outerKeys, _setOuterKeys] = useState([0, 1]);
  setOuterKeys = _setOuterKeys;
  return (
    <list>
      {outerKeys.map((k) => (
        <list-item key={k} item-key={`o${k}`}>
          <list>
            {[0, 1].map((j) => (
              <list-item key={j} item-key={`i${k}-${j}`}>
                <Row text={`${k}-${j}-a`} />
                <Row text={`${k}-${j}-b`} />
              </list-item>
            ))}
          </list>
        </list-item>
      ))}
    </list>
  );
}

function bySign(list, sign) {
  return [...list.children].find(element => element.$$uiSign === sign);
}

function shown(list, sign) {
  return [...bySign(list, sign).children].map(text => text.textContent);
}

describe('a list item with a nested list, removed and then reused', () => {
  it('keeps the nested list serving intact items', async () => {
    const { container } = render(<App />, { enableMainThread: true });
    const outer = container.firstChild;
    lynxTestingEnv.switchToMainThread();
    const retired = __root.childNodes[0].childNodes[0];
    const retiredInner = retired.childNodes[0];
    lynxTestingEnv.switchToBackgroundThread();

    // Outer item 0 is shown, its nested list shows item 0 and pools item 1.
    const so0 = elementTree.enterListItemAtIndex(outer, 0);
    const inner = bySign(outer, so0).firstChild;
    const si00 = elementTree.enterListItemAtIndex(inner, 0);
    const si01 = elementTree.enterListItemAtIndex(inner, 1);
    elementTree.leaveListItem(inner, si01);

    // The background removes outer item 0; native hands it back and asks for
    // the item now at index 0, which reuses it. Its nested list's children
    // are still held by that list under their old signs.
    await act(() => {
      setOuterKeys([1]);
    });
    elementTree.leaveListItem(outer, so0);
    expect(elementTree.enterListItemAtIndex(outer, 0)).toBe(so0);

    // The reused item and its nested list holder are released; the nested
    // items stay intact for the nested list to reuse.
    expect(retired.__element_root).toBeUndefined();
    expect(retired.parentNode?.type ?? null).toBeNull();
    expect(retiredInner.__elements).toBeUndefined();
    expect(retiredInner.parentNode?.type ?? null).toBeNull();
    for (const innerItem of retiredInner.childNodes) {
      expect(innerItem.__element_root).toBeDefined();
      expect(innerItem.childNodes).toHaveLength(2);
    }

    elementTree.leaveListItem(inner, si00);
    const first = elementTree.enterListItemAtIndex(inner, 0);
    const second = elementTree.enterListItemAtIndex(inner, 1);
    expect(shown(inner, first)).toEqual(['1-0-a', '1-0-b']);
    expect(shown(inner, second)).toEqual(['1-1-a', '1-1-b']);
  });
});
