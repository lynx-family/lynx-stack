import '@testing-library/jest-dom';
import { expect, test } from 'vitest';
import { render } from '..';

function Comp() {
  return (
    <view>
      <background-only fallback={<text>loading</text>}>
        <text>content</text>
      </background-only>
    </view>
  );
}

test('renders the fallback on the main thread first screen', () => {
  const { container } = render(<Comp />, {
    enableMainThread: true,
    enableBackgroundThread: false,
  });
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view>
        <text>
          loading
        </text>
      </view>
    </page>
  `);
});

test('renders the children after the background thread takes over', () => {
  const { container } = render(<Comp />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view>
        <text>
          content
        </text>
      </view>
    </page>
  `);
});
