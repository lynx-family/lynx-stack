export function bar() {
  return import(
    /* webpackChunkName: "baz" */
    './baz.js'
  ).then(({ baz }) => 'bar ' + baz());
}
