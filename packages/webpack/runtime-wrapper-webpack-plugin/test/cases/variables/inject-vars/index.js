/// <reference types="@rspack/test-tools/rstest" />

expect(typeof Component).toBe('undefined');
try {
  expect(Component).toBe(undefined);
  expect.fail('Component should not be defined');
} catch {
  // ignore error
}
expect(__Component).toBe(undefined);
