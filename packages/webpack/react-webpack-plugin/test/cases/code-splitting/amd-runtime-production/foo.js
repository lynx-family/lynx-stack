export async function foo() {
  expect(globDynamicComponentEntry).toBeUndefined();
  const { bar } = await import('./bar.js');
  return 'foo ' + await bar();
}
