import '@testing-library/jest-dom';
import { expect, expectTypeOf, test } from '@rstest/core';
import { fireEvent, render } from '@lynx-js/react/testing-library';

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

test('render without options keeps the default query types', async () => {
  const { findByText } = render(<text>Hello</text>);

  expectTypeOf(findByText).returns.toEqualTypeOf<Promise<HTMLElement>>();

  fireEvent.tap(await findByText('Hello'));
});
