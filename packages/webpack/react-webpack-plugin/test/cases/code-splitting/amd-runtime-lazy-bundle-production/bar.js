export function bar() {
  expect(globDynamicComponentEntry).toBeUndefined();
  return import('./baz.js').then(({ baz }) => {
    return `bar ${baz()}`;
  });
}
