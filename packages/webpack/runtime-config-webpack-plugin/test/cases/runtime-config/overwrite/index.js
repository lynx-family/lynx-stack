it('should replace previous config with the current bundle config', () => {
  expect(lynx.__runtime_configs__).toEqual({
    sharedConfig: {
      source: 'current',
    },
  });
  expect(lynx.__runtime_configs__).not.toBe(globalThis.__earlierRuntimeConfig);
  expect(Object.isFrozen(lynx.__runtime_configs__)).toBe(false);
});
