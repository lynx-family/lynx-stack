import '@testing-library/jest-dom';
import { rs } from '@rstest/core';
import { test } from '@rstest/core';
import { act, render } from '..';
import { useState } from 'preact/hooks';
import { expect } from '@rstest/core';

test('render calls useEffect immediately', async () => {
  lynxTestingEnv.switchToMainThread();
  rs.spyOn(lynxTestingEnv.mainThread.globalThis, '__RemoveElement');

  let _setLen;
  function Comp() {
    const [len, setLen] = useState(6);
    _setLen = setLen;

    return (
      <view>
        {Array.from({ length: len }, (_, i) => <view key={i} id={`child-${i}`} />)}
      </view>
    );
  }

  const { container } = render(<Comp />);
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view>
        <view
          id="child-0"
        />
        <view
          id="child-1"
        />
        <view
          id="child-2"
        />
        <view
          id="child-3"
        />
        <view
          id="child-4"
        />
        <view
          id="child-5"
        />
      </view>
    </page>
  `);
  act(() => {
    _setLen(3);
  });
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view>
        <view
          id="child-0"
        />
        <view
          id="child-1"
        />
        <view
          id="child-2"
        />
      </view>
    </page>
  `);
  expect(__RemoveElement).toBeCalledTimes(3);
});
