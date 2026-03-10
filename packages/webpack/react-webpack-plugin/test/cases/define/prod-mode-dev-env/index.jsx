it('__DEV__ should be true when mode is production but NODE_ENV is development', () => {
  expect(__DEV__).toBe(true);
  expect(__PROFILE__).toBe(true);
});
