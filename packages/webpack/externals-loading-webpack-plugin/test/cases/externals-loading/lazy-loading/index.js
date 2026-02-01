it('should lazy load externals', async () => {
  lynx.fetchBundle.mockClear();
  lynx.loadScript.mockClear();
  // remove cache created by other test cases
  delete lynx[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')][Symbol.for('Foo')];

  expect(lynx.fetchBundle).toHaveBeenCalledTimes(0);
  expect(lynx.loadScript).toHaveBeenCalledTimes(0);

  // Now, dynamically import the external.
  const { add } = await import('foo');

  expect(lynx.fetchBundle).toHaveBeenCalledTimes(1);
  expect(lynx.loadScript).toHaveBeenCalledTimes(1);

  // Use the imported function to make sure it's working
  expect(add(1, 2)).toBe(3);

  // a second import
  const { add: add2 } = await import('foo');

  expect(lynx.fetchBundle).toHaveBeenCalledTimes(1);
  expect(lynx.loadScript).toHaveBeenCalledTimes(1);

  expect(add2(2, 3)).toBe(5);
});
