// Skip setup in test environment because `require` does not work
// in vitest esm env, and `lynx.getDevtool` is not mocked yet
if (__DEV__ && process.env.NODE_ENV !== 'test') {
  // We cannot use dynamic import here because
  // dynamic import will generate a new lazy bundle
  // which is not what we needed
  require('./setup').setupReactLynx();
}
