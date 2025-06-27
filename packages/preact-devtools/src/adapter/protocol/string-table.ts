export type StringTable = Map<string, number>;

/**
 * The string table holds a mapping of strings to ids. This saves a lot of space
 * in messaging because we can only need to declare a string once and can later
 * refer to its id. This is especially true for component or element names which
 * expectedoccur multiple times.
 */

/**
 * Convert a string to an id. Works similar to a gzip dictionary.
 */
export function getStringId(table: StringTable, input: string): number {
  if (input === null) return 0;

  if (!table.has(input)) {
    table.set('' + input, table.size + 1);
  }

  return table.get(input)!;
}

// TODO: Use a proper LRU cache?
const encoded = new Map<string, number[]>();

const toCodePoint = (s: string) => s.codePointAt(0) || 124; // "|"" symbol;

/**
 * Convert a string to an array of codepoints
 */
export function encode(input: string): number[] {
  if (!encoded.has(input)) {
    encoded.set(input, input.split('').map(toCodePoint));
  }
  return encoded.get(input)!;
}

/**
 * Convert string table to something the extension understands
 * @param {import('./devtools').AdapterState["stringTable"]} table
 * @returns {number[]}
 */
export function flushTable(table: StringTable) {
  const ops = [0];

  table.forEach((_, k) => {
    ops[0] += k.length + 1;
    ops.push(k.length, ...encode(k));
  });

  return ops;
}

/**
 * Parse message to strings
 */
export function parseTable(data: number[]) {
  const len = data[0];
  const strings = [];
  if (len > 0) {
    for (let i = 1; i < len; i++) {
      const strLen = data[i];
      let start = i + 1;
      const end = i + strLen + 1;
      let str = '';
      for (; start < end; start++) {
        str += String.fromCodePoint(data[start]);
      }
      strings.push(str);
      i += strLen;
    }
  }

  return strings;
}
