export async function dynamicAdd(a: number, b: number) {
  const { add } = await import('./add.js');
  return add(a, b);
}
