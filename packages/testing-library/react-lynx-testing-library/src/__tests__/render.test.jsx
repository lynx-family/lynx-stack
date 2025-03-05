import '@lynx-js/lynx-dom-jest-matchers';
import { test } from 'vitest';
import { render, waitSchedule } from '..';
import { createRef } from '@lynx-js/react';
import { expect } from 'vitest';

test('renders view into page', async () => {
  const ref = createRef();
  const Comp = () => {
    return <view ref={ref} />;
  };
  render(<Comp />);
  await waitSchedule();
  expect(ref.current).toMatchInlineSnapshot(`
    NodesRef {
      "_nodeSelectToken": {
        "identifier": "1",
        "type": 2,
      },
      "_selectorQuery": {},
    }
  `);
});

test('renders options.wrapper around node', async () => {
  const WrapperComponent = ({ children }) => (
    <view data-testid='wrapper'>{children}</view>
  );
  const Comp = () => {
    return <view data-testid='inner' />;
  };
  const { getByTestId } = render(<Comp />, {
    wrapper: WrapperComponent,
  });
  // TODO: should we use it and polyfill our API
  // or write our own dom assertion extensions
  expect(getByTestId('wrapper')).toBeInTheElementTree();
  expect(elementTree.root).toMatchInlineSnapshot(`
      <page
        cssId="__Card__:0"
      >
        <view
          dataset={
            {
              "testid": "wrapper",
            }
          }
        >
          <view
            dataset={
              {
                "testid": "inner",
              }
            }
          />
        </view>
      </page>
    `);
});
