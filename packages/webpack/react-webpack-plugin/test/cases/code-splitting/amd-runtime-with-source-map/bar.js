export function bar() {
  return import('./baz.js').then(({ baz }) => {
    return `bar ${baz()}`;
  });
}
