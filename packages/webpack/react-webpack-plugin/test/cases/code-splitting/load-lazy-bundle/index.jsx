/// <reference types="vitest/globals" />
export {};

it('should have lynx.loadLazyBundle', async () => {
  await import('./foo.js');
  await import('./foo2.js');
  expect(lynx.loadLazyBundle).not.toBeUndefined();
});
