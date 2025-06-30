import { ID } from '../../view/store/types';
import { SharedVNode } from './bindings';

/**
 * VNode relationships are encoded as simple numbers for the devtools. We use
 * this function to keep track of existing id's and create new ones if needed.
 */
export interface IdMappingState<T> {
  instToId: Map<any, ID>;
  idToVNode: Map<ID, T>;
  idToInst: Map<ID, any>;
  nextId: ID;
  getInstance: (vnode: T) => any;

  snapshotIdToId: Map<number, ID>;
  idToUniqueIdList: Map<ID, number[] | undefined>;
  uniqueIdToId: Map<number, ID>;

  updateSnapshotId: (oldId: number, newId: number) => void;
  updateIdToUniqueIdRelation: (snapshotId: number, id: number) => void;
}

export function createIdMappingState<T extends SharedVNode>(
  initial: number,
  getInstance: (vnode: T) => any,
): IdMappingState<T> {
  return {
    instToId: new Map(),
    idToVNode: new Map(),
    idToInst: new Map(),
    nextId: initial,
    getInstance,

    snapshotIdToId: new Map(),
    idToUniqueIdList: new Map(),
    uniqueIdToId: new Map(),

    updateSnapshotId: function(oldId: number, newId: number) {
      console.log('this.snapshotIdToId', this.snapshotIdToId);
      console.log('oldId', oldId);
      if (this.snapshotIdToId.has(oldId)) {
        const id = this.snapshotIdToId.get(oldId)!;
        this.snapshotIdToId.delete(oldId);
        this.snapshotIdToId.set(newId, id);

        this.updateIdToUniqueIdRelation(newId, id);
      }
    },

    updateIdToUniqueIdRelation: function(snapshotId: number, id: number) {
      lynx
        // @ts-expect-error type error
        .getNativeApp()
        .callLepusMethod(
          'getUniqueIdListBySnapshotId',
          { snapshotId },
          (ret: { uniqueIdList: number[] }) => {
            if (ret?.uniqueIdList == null) {
              // console.warn("Failed to get unique id for snapshot", snapshotId);
              return;
            }
            const { uniqueIdList } = ret;
            this.idToUniqueIdList.set(id, uniqueIdList);
            if (uniqueIdList != null) {
              for (const uniqueId of uniqueIdList) {
                this.uniqueIdToId.set(uniqueId, id);
              }
            }
          },
        );
    },
  };
}

export function getVNodeById<T>(state: IdMappingState<T>, id: ID): T | null {
  return state.idToVNode.get(id) || null;
}
export function getUniqueListIdById<T>(
  state: IdMappingState<T>,
  id: ID,
): number[] | null {
  return state.idToUniqueIdList.get(id) || null;
}
export function getUniqueListIdBySnapshotId<T>(
  state: IdMappingState<T>,
  snapshotId: number,
): number[] | null {
  const id = state.snapshotIdToId.get(snapshotId);
  if (!id) return null;
  return state.idToUniqueIdList.get(id) || null;
}
export function getIdByUniqueId<T>(
  state: IdMappingState<T>,
  uniqueId: number,
): ID | null {
  return state.uniqueIdToId.get(uniqueId) || null;
}

export function hasVNodeId<T>(state: IdMappingState<T>, vnode: T) {
  return vnode != null && state.instToId.has(state.getInstance(vnode));
}

export function getVNodeId<T>(state: IdMappingState<T>, vnode: T) {
  if (vnode == null) return -1;
  const inst = state.getInstance(vnode);
  return state.instToId.get(inst) || -1;
}

export function getOrCreateVNodeId<T>(
  state: IdMappingState<T>,
  vnode: T,
): number | undefined {
  const id = getVNodeId(state, vnode);
  if (id !== -1) return id;
  return createVNodeId(state, vnode);
}

export function updateVNodeId<T>(state: IdMappingState<T>, id: ID, vnode: T) {
  const inst = state.getInstance(vnode);
  state.idToInst.set(id, inst);
  state.idToVNode.set(id, vnode);

  let snapshotId;
  try {
    // @ts-ignore
    snapshotId = vnode.__e.__id;
  } catch (e) {
    // It is as expected when destroying
    // console.log('updateVNodeId vnode', vnode)
    return;
  }
  state.snapshotIdToId.set(snapshotId, id);

  state.updateIdToUniqueIdRelation(snapshotId, id);
}

export function removeVNodeId<T>(state: IdMappingState<T>, vnode: T) {
  if (hasVNodeId(state, vnode)) {
    const id = getVNodeId(state, vnode);
    state.idToInst.delete(id);
    state.idToVNode.delete(id);

    let snapshotId;
    try {
      // @ts-ignore
      snapshotId = vnode.__e.__id;
    } catch (e) {
      // It is as expected when destroying
      // console.log('updateVNodeId vnode', vnode)
      return;
    }
    state.snapshotIdToId.delete(snapshotId);

    const uniqueIdList = state.idToUniqueIdList.get(id);
    state.idToUniqueIdList.delete(id);
    if (uniqueIdList != null) {
      for (const uniqueId of uniqueIdList) {
        state.uniqueIdToId.delete(uniqueId);
      }
    }
  }
  const inst = state.getInstance(vnode);
  state.instToId.delete(inst);
}

export function createVNodeId<T>(state: IdMappingState<T>, vnode: T) {
  const id = state.nextId++;
  const inst = state.getInstance(vnode);
  state.instToId.set(inst, id);
  state.idToInst.set(id, inst);
  state.idToVNode.set(id, vnode);

  let snapshotId: number;
  try {
    // @ts-ignore
    snapshotId = vnode.__e.__id;
  } catch (e) {
    // It is as expected when destroying
    // console.log('createVNodeId vnode', vnode)
    return;
  }
  state.snapshotIdToId.set(snapshotId, id);

  state.updateIdToUniqueIdRelation(snapshotId, id);
  return id;
}
