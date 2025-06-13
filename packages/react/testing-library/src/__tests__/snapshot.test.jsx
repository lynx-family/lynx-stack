import '@testing-library/jest-dom';
import { test, expect } from 'vitest';
import { render } from '..';
import { useState } from '@lynx-js/react';
import { snapshotInstanceManager } from '../../../runtime/lib/snapshot.js';
import { act } from 'preact/test-utils';

test('removeChild should unlink siblings', async () => {
  let setVisible;
  const Comp = () => {
    const [visible, _setVisible] = useState(true);
    setVisible = _setVisible;
    const showMask = true;

    return (
      <view
        bindtap={() => {
          setVisible(!visible);
        }}
      >
        {visible
          ? (
            <view className='container'>
              {showMask
                ? (
                  <view id='sibling-1' className='sibling-1'>
                    <text>sibling-1</text>
                  </view>
                )
                : null}
              {showMask
                ? (
                  <view id='sibling-2' className='sibling-2'>
                    <text>sibling-2</text>
                  </view>
                )
                : null}
            </view>
          )
          : null}
      </view>
    );
  };
  const { container } = render(<Comp />);

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view>
        <view
          class="container"
        >
          <view
            class="sibling-1"
            id="sibling-1"
          >
            <text>
              sibling-1
            </text>
          </view>
          <view
            class="sibling-2"
            id="sibling-2"
          >
            <text>
              sibling-2
            </text>
          </view>
        </view>
      </view>
    </page>
  `);

  let containerSnapshotInstance, sibling1SnapshotInstance, sibling2SnapshotInstance;

  for (const snapshotInstance of snapshotInstanceManager.values.values()) {
    switch (snapshotInstance.__element_root.className) {
      case 'container':
        containerSnapshotInstance = snapshotInstance;
        break;
      case 'sibling-1':
        sibling1SnapshotInstance = snapshotInstance;
        break;
      case 'sibling-2':
        sibling2SnapshotInstance = snapshotInstance;
        break;
      default:
        break;
    }
  }

  expect(containerSnapshotInstance.childNodes.length).toBe(2);
  expect(containerSnapshotInstance.__firstChild).toBe(sibling1SnapshotInstance);
  expect(sibling1SnapshotInstance.__nextSibling).toBe(sibling2SnapshotInstance);
  expect(sibling2SnapshotInstance.__previousSibling).toBe(sibling1SnapshotInstance);

  act(() => {
    setVisible(false);
  });

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view />
    </page>
  `);

  expect(sibling1SnapshotInstance.__nextSibling).toBe(null);
  expect(sibling2SnapshotInstance.__previousSibling).toBe(null);
});
