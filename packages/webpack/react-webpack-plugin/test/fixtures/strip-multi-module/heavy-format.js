// Logic-only module, reachable only from a component render body. Emptying the
// bodies must still shake it out of the main-thread bundle — the keep-alive
// carries *component* references only, never call targets like this one.
export function formatFeed(a, b, c) {
  const HEAVY_LOGIC_MARKER = 'HEAVY_FORMAT_LOGIC_ONLY_MARKER';
  return [a, b, c].map((n, i) => ({
    id: i,
    label: `${HEAVY_LOGIC_MARKER}:${n}`,
  }));
}
