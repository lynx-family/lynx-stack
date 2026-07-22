export function load() {
  return import(
    /* webpackChunkName: '../dynamic.js:background' */
    '../dynamic.js'
  );
}
