it('should inject builtin attribute-name transform rules', () => {
  expect(__EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__).toEqual({
    mode: 'dash-case',
    preserve: ['tailColorConvert'],
    rename: {
      textMaxline: 'custom-maxline',
    },
  });
});
