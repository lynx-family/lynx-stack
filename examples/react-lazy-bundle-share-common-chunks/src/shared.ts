import './shared.css';

const table: Record<string, string> = {};

export function describe(page: string): string {
  table[page] ??= ['SHARED', 'MODULE', 'BODY', page].join('_');
  return table[page];
}

export function seenPages(): number {
  return Object.keys(table).length;
}
