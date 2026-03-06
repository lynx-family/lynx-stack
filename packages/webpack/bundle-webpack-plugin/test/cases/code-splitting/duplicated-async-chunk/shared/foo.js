const barPromise = import(
  /* webpackChunkName: "bar" */
  './bar.js'
);

export async function foo() {
  const { bar } = await barPromise;
  return 'foo ' + await bar();
}
