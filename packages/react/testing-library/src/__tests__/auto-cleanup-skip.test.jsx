let render;

beforeAll(async () => {
  process.env.PTL_SKIP_AUTO_CLEANUP = 'true';
  const rtl = await import('..');
  render = rtl.render;
});

// This one verifies that if PTL_SKIP_AUTO_CLEANUP is set
// then we DON'T auto-wire up the afterEach for folks
test('first', () => {
  render(<text>hi</text>);
});

test('second', () => {
  expect(elementTree.root).toMatchInlineSnapshot(`
    <page>
      <text>
        hi
      </text>
    </page>
  `);
});
