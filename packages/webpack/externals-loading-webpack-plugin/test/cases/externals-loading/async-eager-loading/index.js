it('should eager load async externals', async () => {
  lynx.fetchBundle.mockClear();
  lynx.loadScript.mockClear();
  // remove cache created by other test cases
  delete lynx[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')][Symbol.for('Foo')];

  expect(lynx.fetchBundle).toHaveBeenCalledTimes(0);
  expect(lynx.loadScript).toHaveBeenCalledTimes(0);

  // For async externals, the fetch should start immediately upon import/require resolution
  // because the generated code accesses the property which triggers createLoadExternalAsync
  const ns = await import('@lynx-js/foo');

  // Even without accessing any properties on 'ns', the fetch should have implicitly started
  // because Rspack runtime accesses the external to export it.
  expect(lynx.fetchBundle).toHaveBeenCalledTimes(1);
  expect(lynx.loadScript).toHaveBeenCalledTimes(1);

  // Accessing property should work (it might await the promise internally if we handled it,
  // but here we just check eager start)
  // Note: createLoadExternalAsync returns a Promise, so the default export is likely that Promise or the result.
  // In the mock setup, loadScript returns the module object directly because createLoadExternalAsync
  // implementation in the plugin awaits the fetch.

  // Wait, correct checking:
  // The plugin generates: createLoadExternalAsync(...)
  // which returns `new Promise(...)`.
  // So `ns.default` should be that Promise (if Rspack treats it as default export of CJS).

  expect(ns.default).toBeDefined();
});
