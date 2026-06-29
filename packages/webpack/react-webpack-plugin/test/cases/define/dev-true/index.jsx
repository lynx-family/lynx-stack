it('__DEV__ should be true', () => {
  expect(__DEV__).toBe(true);
  expect(__PROFILE__).toBe(true);
  expect(__REACT_DEVTOOL__).toBe(true);
});
