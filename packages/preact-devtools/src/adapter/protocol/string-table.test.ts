import { parseTable, flushTable } from './string-table';
import { expect } from 'chai';

describe('StringTable', () => {
  describe('flushTable', () => {
    it('should flush', () => {
      const table = new Map([
        ['abc', 1],
        ['foo', 2],
      ]);
      expect(flushTable(table)).to.deep.equal([
        8,
        3,
        97,
        98,
        99,
        3,
        102,
        111,
        111,
      ]);
    });
  });

  describe('parseTable', () => {
    it('should parse single string', () => {
      const data = [4, 3, 97, 98, 99];
      expect(parseTable(data)).to.deep.equal(['abc']);
    });

    it('should parse multiple strings', () => {
      const data = [8, 3, 97, 98, 99, 3, 102, 111, 111];
      expect(parseTable(data)).to.deep.equal(['abc', 'foo']);
    });
  });
});
