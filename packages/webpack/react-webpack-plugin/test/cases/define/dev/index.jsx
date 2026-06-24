it('__DEV__ should be false', () => {
  expect(__DEV__).toBe(false);
  expect(__PROFILE__).toBe(false);
  expect(__REACT_DEVTOOL__).toBe(false);
});
