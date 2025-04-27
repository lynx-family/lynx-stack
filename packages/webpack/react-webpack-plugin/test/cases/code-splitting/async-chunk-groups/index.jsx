// Extra dynamic import in background thread
if (__BACKGROUND__) {
  import('./foo.js');
}

it('should have chunkName', async () => {
  const { foo } = await import('./foo.js');
  await expect(foo()).resolves.toBe(`**foo**`);
});
