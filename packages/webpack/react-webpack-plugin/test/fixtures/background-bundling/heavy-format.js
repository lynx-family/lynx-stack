// Logic-only module. Must NOT appear in the main-thread bundle when its only
// consumer is a background-rendered subtree.
export function formatFeed(a, b, c) {
  const HEAVY_LOGIC_MARKER = 'HEAVY_FORMAT_LOGIC_ONLY_MARKER';
  return [a, b, c].map((n, i) => ({ id: i, label: `${HEAVY_LOGIC_MARKER}:${n}` }));
}
