import { render } from '..';

// This just verifies that by importing PTL in an
// environment which supports afterEach (like jest)
// we'll get automatic cleanup between tests.
test('first', () => {
  render(<text>hi</text>);
});

test('second', () => {
  expect(elementTree.root).toMatchInlineSnapshot(`undefined`);
});
