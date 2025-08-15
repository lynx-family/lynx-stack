import '@testing-library/jest-dom';
import { expect, test } from 'vitest';
import { render } from '@lynx-js/react/testing-library';

test('render basic component', () => {
  const Comp = () => {
    return <text>Hello</text>;
  };

  const { container, unmount } = render(<Comp />, {
    wrapper: ({ children }) => {
      return <view>{children}</view>;
    },
  });

  expect(container).toBeInTheDocument();

  unmount();
});

test('render ReactNode types other than ReactElement', () => {
  [
    null,
    undefined,
    1,
    'string',
    false,
    true,
    [],
  ].forEach((node) => {
    render(node);
  });
});
