import { expect } from 'chai';
import { fromSnapshot, toStringTable } from './debug';
import { MsgTypes } from './protocol/events-types';
import { DevNodeType } from '../view/store/types';

describe('debug', () => {
  describe('fromSnapshot', () => {
    it('should parse \'rootId\'', () => {
      const root = 1;
      expect(fromSnapshot(['rootId: ' + root])).to.deep.equal([
        root,
        0,
        MsgTypes.ADD_ROOT,
        root,
      ]);
    });

    it('should parse \'Add node\'', () => {
      const root = 1;
      expect(
        fromSnapshot(['rootId: ' + root, 'Add 2 <div> to parent ' + root]),
      ).to.deep.equal([
        root,
        ...toStringTable('div'),
        MsgTypes.ADD_ROOT,
        root,
        MsgTypes.ADD_VNODE,
        2,
        DevNodeType.Element,
        1,
        9999,
        1,
        0,
        42000,
        42000,
      ]);
    });

    it('should parse \'Update timings\'', () => {
      const root = 1;
      expect(
        fromSnapshot(['rootId: ' + root, 'Update timings 2 duration 12']),
      ).to.deep.equal([
        root,
        0,
        MsgTypes.ADD_ROOT,
        root,
        MsgTypes.UPDATE_VNODE_TIMINGS,
        2,
        12,
      ]);
    });

    it('should parse \'Remove node\'', () => {
      const root = 1;
      expect(fromSnapshot(['rootId: ' + root, 'Remove 2'])).to.deep.equal([
        root,
        0,
        MsgTypes.REMOVE_VNODE,
        1,
        2,
        MsgTypes.ADD_ROOT,
        root,
      ]);
    });

    it('should parse multiple \'Remove node\'', () => {
      const root = 1;
      expect(
        fromSnapshot(['rootId: ' + root, 'Remove 2', 'Remove 3']),
      ).to.deep.equal([
        root,
        0,
        MsgTypes.REMOVE_VNODE,
        2,
        2,
        3,
        MsgTypes.ADD_ROOT,
        root,
      ]);
    });

    it('should parse \'Reordering\'', () => {
      const root = 1;
      expect(
        fromSnapshot(['rootId: ' + root, 'Reorder 2 [3, 4, 5]']),
      ).to.deep.equal([
        root,
        0,
        MsgTypes.ADD_ROOT,
        root,
        MsgTypes.REORDER_CHILDREN,
        2,
        3,
        3,
        4,
        5,
      ]);
    });
  });
});
