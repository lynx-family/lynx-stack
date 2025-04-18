import '@testing-library/jest-dom';
import { expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '../pure';

it('basic', async function() {
  const Button = ({
    children,
    onClick,
  }) => {
    return <view bindtap={onClick}>{children}</view>;
  };
  const onClick = vi.fn(() => {
  });

  const { container } = render(
    <Button onClick={onClick}>
      <text data-testid='text'>Click me</text>
    </Button>,
  );

  expect(onClick).not.toHaveBeenCalled();
  fireEvent.tap(container.firstChild);
  expect(onClick).toBeCalledTimes(1);
  expect(screen.getByTestId('text')).toHaveTextContent('Click me');
});
