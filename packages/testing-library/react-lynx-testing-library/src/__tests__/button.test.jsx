import { expect, it, vi } from 'vitest';
import { render } from '../pure';
import { fireEvent } from '@lynx-js/lynx-dom-testing-library';

it('basic', async function() {
  const Button = ({
    children,
    onClick,
  }) => {
    return <view bindtap={onClick}>{children}</view>;
  };
  const onClick = vi.fn(() => {
  });

  const { container } = render(<Button onClick={onClick}>Click me</Button>);

  expect(onClick).not.toHaveBeenCalled();
  fireEvent.tap(container.children[0]);
  expect(onClick).toBeCalledTimes(1);
});
