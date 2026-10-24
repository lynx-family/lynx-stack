it('should merge config and overwrite conflicts with the current bundle', () => {
  expect(lynx.__runtime_configs__).toEqual({
    earlierOnlyConfig: true,
    sharedConfig: {
      source: 'current',
    },
  });
  expect(lynx.__runtime_configs__).toBe(globalThis.__earlierRuntimeConfig);
  expect(Object.isFrozen(lynx.__runtime_configs__)).toBe(true);
});
