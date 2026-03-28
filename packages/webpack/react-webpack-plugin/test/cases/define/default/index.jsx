it('should inject env variables', () => {
  /* eslint-disable */
  expect(__FIRST_SCREEN_SYNC_TIMING__).toBe('immediately');
  expect(__GLOBAL_PROPS_MODE__).toBe('reactive');
  expect(__EXTRACT_STR__).toBe(false);
  expect(__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__).toBe(false);
  expect(__PROFILE__).toBe(false);

  if (__filename.includes('main-thread')) {
    // This is false in LEPUS bundle
    expect(__LEPUS__).toBe(true);
    expect(__MAIN_THREAD__).toBe(true);
    expect(__JS__).toBe(false);
    expect(__BACKGROUND__).toBe(false);
  } else {
    // This is false in JS bundle
    expect(__LEPUS__).toBe(false);
    expect(__MAIN_THREAD__).toBe(false);
    expect(__JS__).toBe(true);
    expect(__BACKGROUND__).toBe(true);
  }
});
