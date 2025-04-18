import '@testing-library/jest-dom';
import { test, expect } from 'vitest';
import { render } from '..';
import { createRef } from '@lynx-js/react';

test('renders view into page', async () => {
  const ref = createRef();
  const Comp = () => {
    return (
      <view ref={ref}>
        <image />
        <text />
        <view />
        <scroll-view />
      </view>
    );
  };
  render(<Comp />);
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
  const WrapperComponent = ({ children }) => <view data-testid='wrapper'>{children}</view>;
  const Comp = () => {
    return <view data-testid='inner' style='background-color: yellow;' />;
  };
  const { container, getByTestId } = render(<Comp />, {
    wrapper: WrapperComponent,
  });
  expect(getByTestId('wrapper')).toBeInTheDocument();
  expect(container.firstChild).toMatchInlineSnapshot(`
    <view
      data-testid="wrapper"
    >
      <view
        data-testid="inner"
        style="background-color: yellow;"
      />
    </view>
  `);
});
