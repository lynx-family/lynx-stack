import { expect } from 'chai';
import { patchTree } from './patchTree';
import { flames } from '../testHelpers';
import { Tree, DevNode, ID } from '../../../../store/types';
import { NodeTransform } from '../shared';

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toTimings(tree: Tree, flame: Map<ID, NodeTransform>) {
  return Array.from(flame.values())
    .map(pos => {
      const node = tree.get(pos.id)!;
      return {
        id: pos.id,
        name: node.name,
        children: node.children,
        start: round(pos.x),
        end: round(pos.x + pos.width),
      };
    })
    .sort((a, b) => a.id - b.id);
}

export function patch(
  data: ReturnType<typeof flames>,
  rootId: ID,
  commitRootId: ID,
) {
  return toTimings(
    data.idMap,
    patchTree({
      ...data.commit,
      rootId,
      commitRootId,
      duration: 100,
      maxSelfDuration: 100,
    }),
  );
}

export function byName(tree: Tree, name: string) {
  return Array.from(tree.values()).find(node => node.name === name);
}

export function prepareFixture(fixture: {
  previous: DevNode[];
  next: DevNode[];
  expected: ReturnType<typeof toTimings>;
}) {
  const { previous, next, expected } = fixture;
  return {
    previous: new Map(previous.map(node => [node.id, node])),
    previousRoot: previous.length ? previous[0].id : -42,
    next: new Map(next.map(node => [node.id, node])),
    nextRoot: next[0].id,
    expected,
  };
}

describe('patchTree', () => {
  it('should offset timings if tree is new', () => {
    const b = flames`
			App *******
				Bar **
		`;

    b.nodes.forEach(x => {
      x.startTime += 200;
      x.endTime += 200;
    });

    const actual = patch(b, 1, 1);
    expect(actual).to.deep.equal([
      { name: 'App', id: 1, start: 0, end: 110, children: [2] },
      { name: 'Bar', id: 2, start: 50, end: 110, children: [] },
    ]);
  });

  it('should expand tree', () => {
    const tree = flames`
			App **
			 Bar ***
			  Bob *
		`;

    const actual = patch(tree, 1, 2);
    expect(actual).to.deep.equal([
      { name: 'App', id: 1, start: 0, end: 70.01, children: [2] },
      { name: 'Bar', id: 2, start: 0.01, end: 70.01, children: [3] },
      { name: 'Bob', id: 3, start: 20.01, end: 70.01, children: [] },
    ]);
  });

  it('should fix positive offset tree', () => {
    const b = flames`
			App *****
			 Bar ***
			  Bob *
		`;

    b.nodes.forEach(x => {
      if (x.name !== 'App') {
        x.startTime += 100;
        x.endTime += 100;
      }
    });

    const actual = patch(b, 1, 1);
    expect(actual).to.deep.equal([
      // TODO: App is detected as a static tree
      { name: 'App', id: 1, start: 0, end: 90, children: [2] },
      { name: 'Bar', id: 2, start: 20, end: 90, children: [3] },
      { name: 'Bob', id: 3, start: 40, end: 90, children: [] },
    ]);
  });

  it('should move siblings to the right', () => {
    const b = flames`
			App *************
			 Bar ****  Bob **
		`;

    b.byName('Bob')!.startTime -= 40;
    b.byName('Bob')!.endTime -= 40;

    const actual = patch(b, 1, 2);
    expect(actual).to.deep.equal([
      {
        name: 'App',
        id: 1,
        start: 0,
        end: 170,
        children: [2, 3],
      },
      {
        name: 'Bar',
        id: 2,
        start: 30,
        end: 110,
        children: [],
      },
      { name: 'Bob', id: 3, start: 110, end: 170, children: [] },
    ]);
  });

  it('should enlarge parent', () => {
    const a = flames`
			App ****
			 Bar *****
		`;

    const actual = patch(a, 1, 2);
    expect(actual).to.deep.equal([
      { name: 'App', id: 1, start: 0, end: 90.01, children: [2] },
      { name: 'Bar', id: 2, start: 0.01, end: 90.01, children: [] },
    ]);
  });

  it('should support move static sub-tree', () => {
    const b = flames`
			App *****
			 Bar ***
			  Bob *
		`;

    b.nodes.forEach(node => {
      if (node.name !== 'App') {
        node.startTime -= 100;
        node.endTime -= 100;
      }
    });

    const actual = patch(b, 1, 1);
    expect(actual).to.deep.equal([
      { name: 'App', id: 1, start: 0, end: 90, children: [2] },
      { name: 'Bar', id: 2, start: 20, end: 90, children: [3] },
      { name: 'Bob', id: 3, start: 40, end: 90, children: [] },
    ]);
  });
});
