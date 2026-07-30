// Logic-only module, reachable only from a 'background only' render body.
// The stub shell drops the import edge, so none of this reaches the
// main-thread bundle.
const ADJECTIVES = [
  'quick',
  'lazy',
  'bright',
  'calm',
  'eager',
  'gentle',
  'happy',
  'jolly',
];

export interface FeedItem {
  id: string;
  title: string;
}

export function formatFeed(count: number): FeedItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    title: `Row ${index} — a ${
      ADJECTIVES[index % ADJECTIVES.length]
    } list item`,
  }));
}
