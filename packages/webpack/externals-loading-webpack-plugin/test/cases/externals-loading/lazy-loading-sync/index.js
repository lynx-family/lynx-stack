it('should lazy load sync externals', async () => {
  lynx.fetchBundle.mockClear();
  lynx.loadScript.mockClear();
  // remove cache created by other test cases
  delete lynx[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')][Symbol.for('Foo')];

  // With import/await, Rspack might handle resolution.
  // If the externals plugin works, accessing `foo` properties triggers get().
  // However, getting the namespace object itself might not trigger get() on the default export proxy yet.
  const ns = await import('@lynx-js/foo');

  // If we haven't accessed properties of the PROXY yet, count should be 0.
  expect(lynx.fetchBundle).toHaveBeenCalledTimes(0);
  expect(lynx.loadScript).toHaveBeenCalledTimes(0);

  // The proxy is the default export because it's a CJS-style external (module.exports = proxy)
  // and the proxy hides keys, so named exports aren't enumerable.
  const { default: foo } = ns;

  // Accessing property on the proxy (default export) should trigger fetch
  const result = foo.add(1, 2);
  expect(result).toBe(3);

  // NOW it definitely should have fetched if it is an external.
  expect(lynx.fetchBundle).toHaveBeenCalledTimes(1);
  expect(lynx.loadScript).toHaveBeenCalledTimes(1);

  // Second access should use cache
  expect(foo.add(2, 3)).toBe(5);
  expect(lynx.fetchBundle).toHaveBeenCalledTimes(1);
});
