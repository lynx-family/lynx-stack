import parseSemverish from './parse-semverish';
import { expect } from 'chai';

describe('parse-semverish', () => {
  it('should parse normal', () => {
    expect(parseSemverish('10.0.1')).to.deep.equal({
      major: 10,
      minor: 0,
      patch: 1,
      preRelease: undefined,
    });
  });

  it('should parse big numbers', () => {
    expect(parseSemverish('10.10.10')).to.deep.equal({
      major: 10,
      minor: 10,
      patch: 10,
      preRelease: undefined,
    });
  });

  it('should parse tags', () => {
    expect(parseSemverish('10.2.3-alpha.0')).to.deep.equal({
      major: 10,
      minor: 2,
      patch: 3,
      preRelease: {
        tag: 'alpha',
        version: 0,
      },
    });
  });

  it('should parse incomplete tags', () => {
    expect(parseSemverish('10.2.3-alpha')).to.deep.equal({
      major: 10,
      minor: 2,
      patch: 3,
      preRelease: {
        tag: 'alpha',
        version: -1,
      },
    });
  });

  it('should parse tags with dash', () => {
    expect(parseSemverish('10.2.3-alpha-hehe.2')).to.deep.equal({
      major: 10,
      minor: 2,
      patch: 3,
      preRelease: {
        tag: 'alpha-hehe',
        version: 2,
      },
    });
  });
});
