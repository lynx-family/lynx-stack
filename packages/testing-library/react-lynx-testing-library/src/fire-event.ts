import {
  fireEvent as domFireEvent,
  createEvent,
} from '@lynx-js/lynx-dom-testing-library';
import { options } from 'preact';

let isCompat = false;

//  Detects if preact/compat is used
const oldHook = options.vnode;
options.vnode = (vnode) => {
  if (vnode.$$typeof) isCompat = true;
  if (oldHook) oldHook(vnode);
};

//  Renames event to match React (preact/compat) version
const renameEventCompat = (key) => {
  return key === 'change' ? 'input' : key;
};

function getElement(elemOrNodesRef) {
  if (elemOrNodesRef?.constructor?.name === 'NodesRef') {
    return __GetElementByUniqueId(
      Number(elemOrNodesRef._nodeSelectToken.identifier),
    );
  } else if (elemOrNodesRef?.constructor?.name === 'LynxFiberElement') {
    return elemOrNodesRef;
  } else {
    throw new Error(
      'Invalid element, got: ' + elemOrNodesRef.constructor?.name,
    );
  }
}
// Similar to RTL we make are own fireEvent helper that just calls DTL's fireEvent with that
// we can that any specific behaviors to the helpers we need
export const fireEvent = (elemOrNodesRef, ...args) => {
  const isMainThread = __LEPUS__;

  // switch to background thread
  lynxDOM.switchToBackgroundThread();

  const elem = getElement(elemOrNodesRef);

  let ans = domFireEvent(elem, ...args);

  if (isMainThread) {
    // switch back to main thread
    lynxDOM.switchToMainThread();
  }

  return ans;
};

Object.keys(domFireEvent).forEach((key) => {
  fireEvent[key] = (elemOrNodesRef, init) => {
    const isMainThread = __LEPUS__;
    // switch to background thread
    lynxDOM.switchToBackgroundThread();

    // Preact changes all change events to input events when running 'preact/compat',
    // making the event name out of sync.
    // The problematic code is in: preact/compat/src/render.js > handleDomVNode()
    const keyFiltered = !isCompat ? key : renameEventCompat(key);

    const elem = getElement(elemOrNodesRef);
    const ans = domFireEvent[keyFiltered](elem, init);

    if (isMainThread) {
      // switch back to main thread
      lynxDOM.switchToMainThread();
    }

    return ans;
  };
});
