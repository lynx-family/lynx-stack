import './shared.css';

const table: Record<string, string> = {};

export function describe(page: string): string {
  table[page] ??= ['SHARED', 'MODULE', 'BODY', page].join('_');
  return table[page];
}

export function describeOnMainThread(page: string): string {
  'main thread';
  return ['SHARED', 'MODULE', 'BODY', page].join('_');
}
