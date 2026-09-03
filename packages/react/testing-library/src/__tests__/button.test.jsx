import '@testing-library/jest-dom';
import { expect, it, rs } from '@rstest/core';
import { render, fireEvent, screen } from '../pure';

it('basic', async function() {
  const Button = ({
    children,
    onClick,
  }) => {
    return <view bindtap={onClick}>{children}</view>;
  };
  const onClick = rs.fn(() => {
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
