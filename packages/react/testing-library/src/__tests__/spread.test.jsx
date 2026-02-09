import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { act, render } from '..';
import { expect } from 'vitest';
import { useState } from 'preact/hooks';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/debug/formatPatch';
import { BackgroundSnapshotInstance } from '@lynx-js/react/internal';

test('re-render with same style should not generate patch without spread', () => {
  vi.spyOn(lynxTestingEnv.mainThread.globalThis, '__SetInlineStyles');
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  vi.spyOn(BackgroundSnapshotInstance.prototype, 'setAttribute');
  const setInlineStylesCalls = lynxTestingEnv.mainThread.globalThis.__SetInlineStyles.mock.calls;
  const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
  const bsiSetAttributeCalls = BackgroundSnapshotInstance.prototype.setAttribute.mock.calls;

  let setCount;
  const Comp = () => {
    const [count, _setCount] = useState(0);
    setCount = _setCount;
    const style = { backgroundColor: 'red' };
    return <view style={style} data-count={count} />;
  };

  render(<Comp />);

  expect(bsiSetAttributeCalls).toMatchInlineSnapshot(`
    [
      [
        "values",
        [
          {
            "backgroundColor": "red",
          },
          0,
        ],
      ],
      [
        "values",
        [
          {
            "backgroundColor": "red",
          },
          0,
        ],
      ],
    ]
  `);
  expect(setInlineStylesCalls).toMatchInlineSnapshot(`
    [
      [
        <view
          data-count="0"
          style="background-color: red;"
        />,
        {
          "backgroundColor": "red",
        },
      ],
    ]
  `);
  bsiSetAttributeCalls.length = 0;
  setInlineStylesCalls.length = 0;
  callLepusMethodCalls.length = 0;

  act(() => {
    setCount(1);
  });
  expect(bsiSetAttributeCalls).toMatchInlineSnapshot(`
    [
      [
        "values",
        [
          {
            "backgroundColor": "red",
          },
          1,
        ],
      ],
    ]
  `);
  // BackgroundSnapshotInstance will intercept the setAttribute call since value is not changed
  expect(prettyFormatSnapshotPatch(JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch))
    .toMatchInlineSnapshot(`
    [
      {
        "dynamicPartIndex": 1,
        "id": 2,
        "op": "SetAttribute",
        "value": 1,
      },
    ]
  `);
  expect(setInlineStylesCalls.length).toBe(0);
});

test('re-render with same style should not generate patch with spread', () => {
  vi.spyOn(lynxTestingEnv.mainThread.globalThis, '__SetInlineStyles');
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  vi.spyOn(BackgroundSnapshotInstance.prototype, 'setAttribute');
  const setInlineStylesCalls = lynxTestingEnv.mainThread.globalThis.__SetInlineStyles.mock.calls;
  const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
  const bsiSetAttributeCalls = BackgroundSnapshotInstance.prototype.setAttribute.mock.calls;

  let setCount;
  const Comp = () => {
    const [count, _setCount] = useState(0);
    setCount = _setCount;
    const style = { backgroundColor: 'red' };
    return <view style={style} {...{ 'data-count': count }} />;
  };

  render(<Comp />);

  expect(bsiSetAttributeCalls).toMatchInlineSnapshot(`
    [
      [
        "values",
        [
          {
            "backgroundColor": "red",
          },
          1,
        ],
      ],
      [
        "values",
        [
          {
            "__spread": {
              "data-count": 0,
              "style": {
                "backgroundColor": "red",
              },
            },
            "data-count": 0,
            "style": {
              "backgroundColor": "red",
            },
          },
        ],
      ],
      [
        "values",
        [
          {
            "__spread": {
              "data-count": 0,
              "style": {
                "backgroundColor": "red",
              },
            },
            "data-count": 0,
            "style": {
              "backgroundColor": "red",
            },
          },
        ],
      ],
    ]
  `);
  expect(setInlineStylesCalls).toMatchInlineSnapshot(`
    [
      [
        <view
          data-count="0"
          style="background-color: red;"
        />,
        {
          "backgroundColor": "red",
        },
      ],
    ]
  `);
  bsiSetAttributeCalls.length = 0;
  setInlineStylesCalls.length = 0;
  callLepusMethodCalls.length = 0;

  act(() => {
    setCount(1);
  });
  expect(bsiSetAttributeCalls).toMatchInlineSnapshot(`
    [
      [
        "values",
        [
          {
            "__spread": {
              "data-count": 1,
              "style": {
                "backgroundColor": "red",
              },
            },
            "data-count": 1,
            "style": {
              "backgroundColor": "red",
            },
          },
        ],
      ],
    ]
  `);
  // BackgroundSnapshotInstance generate a setAttribute call since value is changed
  expect(prettyFormatSnapshotPatch(JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch))
    .toMatchInlineSnapshot(`
    [
      {
        "dynamicPartIndex": 0,
        "id": 2,
        "op": "SetAttribute",
        "value": {
          "data-count": 1,
          "style": {
            "backgroundColor": "red",
          },
        },
      },
    ]
  `);
  expect(setInlineStylesCalls.length).toBe(0);
});
