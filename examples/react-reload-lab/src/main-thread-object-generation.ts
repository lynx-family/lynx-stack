const key = Symbol.for('__MTO_RELOAD_PROBE_GENERATION__');
const host = lynx as unknown as Record<symbol, number>;
const generation = typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__
  ? (host[key] = (host[key] ?? 0) + 1)
  : 0;
let created = 0;

export function getGeneration(): number {
  return generation;
}

export function createProbe(initial: number) {
  return { generation, created: ++created, initial };
}
