import { expect } from 'chai';
import { ops2Tree } from './operations';
import { fromSnapshot } from '../debug';
import { flames } from '../../view/components/profiler/flamegraph/testHelpers';

describe('ops2Tree', () => {
  it('should copy old nodes', () => {
    const state = flames`
        Fragment ***
			`;

    const res = ops2Tree(state.idMap, [], []);
    expect(res.tree).not.to.equal(state.idMap);
    expect(res.tree.size).to.equal(state.idMap.size);
  });

  describe('ADD_ROOT', () => {
    it('should add new roots', () => {
      const ops = fromSnapshot(['rootId: 1']);
      expect(ops2Tree(new Map(), [], ops)).to.deep.equal({
        rootId: 1,
        roots: [1],
        rendered: new Set(),
        removals: [],
        tree: new Map(),
        reasons: new Map(),
        stats: null,
      });
    });
  });

  describe('ADD_VNODE', () => {
    it('should add a vnode', () => {
      const ops = fromSnapshot(['rootId: 1', 'Add 1 <Fragment> to parent -1']);
      expect(
        Array.from(ops2Tree(new Map(), [], ops).tree.values()),
      ).to.deep.equal([
        {
          children: [],
          depth: 0,
          id: 1,
          name: 'Fragment',
          parent: -1,
          owner: 9999,
          type: 3,
          hocs: null,
          key: '',
          startTime: 42,
          endTime: 42,
        },
      ]);
    });

    it('should add a children to its parent', () => {
      const ops = fromSnapshot([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <span> to parent 1',
      ]);

      const { tree } = ops2Tree(new Map(), [], ops);
      expect(Array.from(tree.values())).to.deep.equal([
        {
          children: [2],
          depth: 0,
          id: 1,
          name: 'Fragment',
          parent: -1,
          owner: 9999,
          type: 3,
          key: '',
          hocs: null,
          startTime: 42,
          endTime: 42,
        },
        {
          children: [],
          depth: 1,
          id: 2,
          name: 'span',
          parent: 1,
          owner: 9999,
          type: 1,
          key: '',
          hocs: null,
          startTime: 42,
          endTime: 42,
        },
      ]);
    });
  });

  describe('UPDATE_VNODE_TIMINGS', () => {
    it('should update timings', () => {
      const state = flames`
        Fragment ***
      `;

      const ops = fromSnapshot(['rootId: 1', 'Update timings 1 time 20:40']);
      const next = ops2Tree(state.idMap, [], ops).tree.get(1)!;

      expect(next.startTime).to.equal(20);
      expect(next.endTime).to.equal(40);

      // Should not mutate old tree
      const prev = state.idMap.get(1)!;
      expect(prev.startTime).to.equal(0);
      expect(prev.endTime).to.equal(120);
    });
  });

  describe('REMOVE_VNODE', () => {
    it('should remove all listed vnodes', () => {
      const state = flames`
        Fragment ********
          span ***  a **
            p **
      `;
      const ops = fromSnapshot([
        'rootId: 1',
        'Update timings 1 time 20:40',
        'Update timings 2 time 20:40',
        'Remove 3',
        'Remove 4',
      ]);

      const next = ops2Tree(state.idMap, [], ops).tree;
      const root = next.get(1)!;
      const span = next.get(2)!;

      expect(root.children).to.deep.equal([2]);
      expect(span.children).to.deep.equal([]);
    });

    it('should return removal ids', () => {
      const state = flames`
        Fragment ********
          span ***  a **
            p **
      `;
      const ops = fromSnapshot([
        'rootId: 1',
        'Update timings 1 time 20:40',
        'Update timings 2 time 20:40',
        'Remove 3',
        'Remove 4',
      ]);

      const next = ops2Tree(state.idMap, [], ops);
      expect(next.removals).to.deep.equal([3, 4]);
    });

    it('should remove nodes recursively', () => {
      const state = flames`
        Fragment ********
          span ***  a **
            p **
      `;
      const ops = fromSnapshot([
        'rootId: 1',
        'Update timings 1 time 20:40',
        'Remove 2',
      ]);

      const next = ops2Tree(state.idMap, [], ops);
      expect(Array.from(next.tree.keys())).to.deep.equal([1, 4]);
    });
  });

  describe('REORDER_CHILDREN', () => {
    it('should reorder children', () => {
      const state = flames`
        Fragment ********
          span ***  a **
      `;

      expect(state.byId(1)!.children).to.deep.equal([2, 3]);

      const ops = fromSnapshot([
        'rootId: 1',
        'Update timings 1 time 20:40',
        'Reorder 1 [3,2]',
      ]);

      const next = ops2Tree(state.idMap, [], ops).tree;
      expect(next.get(1)!.children).to.deep.equal([3, 2]);
    });

    it('should end with correct offset', () => {
      const ops = fromSnapshot([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <span> to parent 1',
        'Add 3 <span> to parent 1',
        'Reorder 1 [2,3]',
        'Update timings 1 time 20:40',
      ]);

      expect(() => ops2Tree(new Map(), [], ops)).to.not.throw();
      expect(ops2Tree(new Map(), [], ops).tree.get(1)!.startTime).to.equal(20);
    });
  });
});
