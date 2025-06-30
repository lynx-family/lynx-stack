import { expect } from 'chai';
import { toTransform } from './ranked-utils';
import { flames } from '../testHelpers';
import { NodeTransform } from '../shared';

const required: Partial<NodeTransform> = {
  visible: true,
  maximized: false,
  commitParent: false,
};

describe('toTransform', () => {
  it('should order nodes by selfDuration', () => {
    const tree = flames`
        App **********
          Foo ****
            Bar *
			`;

    expect(toTransform(tree.commit)).to.deep.equal([
      { ...required, id: 1, width: 60, x: 0, row: 0, weight: 9 },
      { ...required, id: 3, width: 50, x: 0, row: 1, weight: 8 },
      { ...required, id: 2, width: 30, x: 0, row: 2, weight: 5 },
    ]);
  });

  it('should order nodes by selfDuration #2', () => {
    const tree = flames`
        App ******************
          Foo ****  Baz **
            Bar *
      `;
    expect(toTransform(tree.commit)).to.deep.equal([
      { ...required, id: 1, width: 80, x: 0, row: 0, weight: 9 },
      { ...required, id: 4, width: 60, x: 0, row: 1, weight: 7 },
      { ...required, id: 3, width: 50, x: 0, row: 2, weight: 6 },
      { ...required, id: 2, width: 30, x: 0, row: 3, weight: 3 },
    ]);
  });
});
