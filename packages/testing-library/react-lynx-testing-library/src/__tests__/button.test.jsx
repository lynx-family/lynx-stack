import { expect, it, vi } from 'vitest';
import { render, fireEvent } from '../pure';

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
  fireEvent.tap(container.firstChild);
  expect(onClick).toBeCalledTimes(1);
});
