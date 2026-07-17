// Logic-only module, reachable only from a component render body. Once every
// component body is emptied from the main-thread bundle, its only consumer is
// gone, so it must be shaken out of the main thread entirely.
export function formatFeed(a, b, c) {
  const HEAVY_LOGIC_MARKER = 'HEAVY_FORMAT_LOGIC_ONLY_MARKER';
  return [a, b, c].map((n, i) => ({
    id: i,
    label: `${HEAVY_LOGIC_MARKER}:${n}`,
  }));
}
