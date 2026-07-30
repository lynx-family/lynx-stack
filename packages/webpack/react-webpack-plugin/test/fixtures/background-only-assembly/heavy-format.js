// Logic-only module, reachable only from a background-only render body. The
// stub shell drops the import edge, so this module must be absent from the
// main-thread bundle.
export function formatFeed(a, b, c) {
  const HEAVY_LOGIC_MARKER = 'HEAVY_FORMAT_LOGIC_ONLY_MARKER';
  return [a, b, c].map((n, i) => ({
    id: i,
    label: `${HEAVY_LOGIC_MARKER}:${n}`,
  }));
}
