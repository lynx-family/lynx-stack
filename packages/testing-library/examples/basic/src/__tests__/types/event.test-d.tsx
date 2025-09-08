// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@testing-library/jest-dom';
import { expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@lynx-js/react/testing-library';

it('basic', async function() {
  const Button = (
    { children, onClick }: { children: JSX.Element; onClick: () => void },
  ) => {
    return <view bindtap={onClick}>{children}</view>;
  };
  const onClick = vi.fn(() => {});

  // ARRANGE
  const { container } = render(
    <Button onClick={onClick}>
      <text data-testid='text'>Click me</text>
    </Button>,
  );

  expect(onClick).not.toHaveBeenCalled();

  // ACT

  // Method 1: Construct the Event object yourself
  const event = new Event('catchEvent:tap');
  Object.assign(event, {
    eventType: 'catchEvent',
    eventName: 'tap',
    key: 'value',
  });
  expect(fireEvent(container.firstChild, event)).toBe(true);

  // Method 2: Pass in event type and initialization parameters
  fireEvent.tap(container.firstChild);
  fireEvent.tap(container.firstChild, {
    eventType: 'catchEvent',
    key: 'value',
  });

  // @ts-expect-error fireEvent.click should not exist
  expect(fireEvent.click).toBeUndefined();

  // ASSERT
  expect(onClick).toBeCalledTimes(1);
  expect(screen.getByTestId('text')).toHaveTextContent('Click me');
});
