import '@testing-library/jest-dom';
import { test } from 'vitest';
import { render } from '..';
import { createRef } from '@lynx-js/react';
import { expect } from 'vitest';

test('renders view into page', async () => {
  const ref = createRef();
  const Comp = () => {
    return <view ref={ref} />;
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
  const WrapperComponent = ({ children }) => (
    <view data-testid='wrapper'>{children}</view>
  );
  const Comp = () => {
    return <view data-testid='inner' />;
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
      />
    </view>
  `);
});
