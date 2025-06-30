import { expect } from 'chai';
import { parseValue, genPreview } from './parseValue';

describe('parseValue', () => {
  it('should parse booleans', () => {
    expect(parseValue('true')).to.equal(true);
    expect(parseValue('false')).to.equal(false);
  });

  it('should parse null/undefined', () => {
    expect(parseValue('null')).to.equal(null);
    expect(parseValue('undefined')).to.equal(undefined);
  });

  it('should treat empty as undefined', () => {
    expect(parseValue('')).to.equal(undefined);
  });

  it('should parse numbers', () => {
    expect(parseValue('123')).to.equal(123);
    expect(parseValue('-123')).to.equal(-123);
    expect(parseValue('+123')).to.equal(123);
    expect(parseValue('-123.23')).to.equal(-123.23);
    expect(parseValue('+123.23')).to.equal(123.23);
    expect(parseValue('.1')).to.equal(0.1);
    expect(parseValue('+.1')).to.equal(0.1);
    expect(parseValue('123.23')).to.equal(123.23);
    expect(parseValue('Infinity')).to.equal(Infinity);
    expect(parseValue('+Infinity')).to.equal(Infinity);
    expect(parseValue('-Infinity')).to.equal(-Infinity);
    expect(isNaN(parseValue('NaN') as any)).to.equal(true);
  });

  it('should parse bigints', () => {
    expect(parseValue('5n')).to.deep.equal({
      type: 'bigint',
      value: '5',
    });
    expect(parseValue('-5n')).to.deep.equal({
      type: 'bigint',
      value: '-5',
    });
    // max int + 1
    expect(parseValue('18446744073709552000n')).to.deep.equal({
      type: 'bigint',
      value: '18446744073709552000',
    });
    // bigger than Number.MAX_VALUE (max double)
    const reallyBig = (10n ** 309n).toString(10);
    expect(parseValue(`${reallyBig}n`)).to.deep.equal({
      type: 'bigint',
      value: reallyBig,
    });
  });

  it('should parse strings', () => {
    expect(parseValue('"abc"')).to.equal('abc');
    expect(parseValue('"123"')).to.equal('123');
    expect(parseValue('""')).to.equal('');
  });

  it('should parse arrays', () => {
    expect(parseValue('[1,2,3]')).to.deep.equal([1, 2, 3]);
  });

  it('should parse objects', () => {
    expect(parseValue('{"a":1,"b":2,"c":3}')).to.deep.equal({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  it('should throw on invalid data', () => {
    expect(() => parseValue('[1,2,3')).to.throw();
  });
});

describe('genPreview', () => {
  it('should format values', () => {
    expect(genPreview(undefined)).to.equal('undefined');
    expect(genPreview(null)).to.equal('null');
    expect(genPreview(-100)).to.equal('-100');
    expect(genPreview(0)).to.equal('0');
    expect(genPreview(-0)).to.equal('0');
    expect(genPreview(10000)).to.equal('10000');
    expect(genPreview('foo')).to.equal('"foo"');
    expect(genPreview([1, 2, { a: 3 }])).to.equal('[1, 2, {a: 3}]');
    expect(genPreview({ a: 123, b: [1, 2] })).to.equal('{a: 123, b: [1, 2]}');
    expect(genPreview({ type: 'bigint', value: '3' })).to.equal('3n');

    expect(genPreview({ type: 'symbol', name: 'Symbol(foo)' })).to.equal(
      'Symbol(foo)',
    );

    // Special values
    expect(genPreview('__preact_empty__')).to.equal('');
  });
});
