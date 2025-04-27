export async function foo() {
  const { bar } = await import('./bar.js');
  return 'foo ' + await bar();
}
