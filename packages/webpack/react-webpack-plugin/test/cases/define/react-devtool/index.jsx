it('__REACT_DEVTOOL__ should be true in production when REACT_DEVTOOL=true', () => {
  expect(__DEV__).toBe(false);
  expect(__REACT_DEVTOOL__).toBe(true);
});
