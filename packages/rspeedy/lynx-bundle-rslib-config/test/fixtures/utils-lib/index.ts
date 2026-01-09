export function add(a: number, b: number): number {
  return a + b
}
// @ts-expect-error
export const abc = globalThis?.abc || 0
