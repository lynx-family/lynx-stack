// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';
import Reconciler from 'react-reconciler';
import type { EventPriority, HostConfig } from 'react-reconciler';

let page: FiberElement;
let pageId: number;
let code: () => ReactNode;
let root: any;

type Type = string;
type Props = Object;

const NoEventPriority = 0b0000000000000000000000000000000;
const DefaultEventPriority = 0b0000000000000000000000000100000;
let currentUpdatePriority: EventPriority = NoEventPriority;
function setCurrentUpdatePriority(newPriority: EventPriority): void {
  currentUpdatePriority = newPriority;
}
function getCurrentUpdatePriority(): EventPriority {
  return currentUpdatePriority;
}
function resolveUpdatePriority(): EventPriority {
  if (currentUpdatePriority !== NoEventPriority) {
    return currentUpdatePriority;
  }
  return DefaultEventPriority;
}

const hostConfig = {
  now: Date.now,
  supportsMutation: true,
  createInstance(type: Type) {
    return __CreateElement(type, pageId!);
  },
  createTextInstance(text: string) {
    return __CreateRawText(text);
  },
  appendInitialChild(parent: FiberElement, child: FiberElement) {
    __InsertElementBefore(parent, child, undefined);
    // __FlushElementTree(parent);
  },
  // @ts-expect-error appendChildToContainer
  appendChildToContainer(container, child): void {
    __InsertElementBefore(container, child, undefined);
  },
  // @ts-expect-error finalizeInitialChildren
  finalizeInitialChildren(instance, type, props, rootContainer, hostContext) {
    console.log(
      'finalizeInitialChildren',
      instance,
      type,
      props,
      rootContainer,
      hostContext,
    );
  },
  shouldSetTextContent(type: string) {
    return type === 'raw-text';
  },
  // @ts-expect-error getRootHostContext
  getRootHostContext(rootContainer) {
    console.log('getRootHostContext', rootContainer);
    return null;
  },
  // @ts-expect-error getChildHostContext
  getChildHostContext(parentHostContext, type, rootContainer) {
    console.log('getChildHostContext', parentHostContext, type, rootContainer);
    return parentHostContext;
  },
  // @ts-expect-error getPublicInstance
  getPublicInstance(instance) {
    return instance;
  },
  resetAfterCommit() {},
  preparePortalMount() {},
  scheduleTimeout() {},
  cancelTimeout() {},
  noTimeout: -1,
  setCurrentUpdatePriority,
  getCurrentUpdatePriority,
  resolveUpdatePriority,
  trackSchedulerEvent(): void {},
  resolveEventType(): null | string {
    return null;
  },
  resolveEventTimeStamp(): number {
    return -1.1;
  },
  shouldAttemptEagerTransition(): boolean {
    return false;
  },
  // @ts-expect-error prepareForCommit
  prepareForCommit(containerInfo: Container): null | Object {
    return null;
  },
  clearContainer(): void {},
  maySuspendCommit(_type: Type, _props: Props): boolean {
    return false;
  },
};

// @ts-expect-error CustomRenderer
const CustomRenderer = Reconciler(hostConfig);

function createRoot(container: FiberElement) {
  const root = CustomRenderer.createContainer(
    container,
    0, // tag
    null, // hydrationCallbacks
    false, // isStrictMode
    false, // concurrentUpdatesByDefaultOverride
    '', // identifierPrefix
    console.error, // onRecoverableError
    null, // transitionCallbacks
  );

  return {
    render(reactElement: ReactNode): void {
      CustomRenderer.updateContainer(reactElement, root, null, null);
    },

    unmount(): void {
      CustomRenderer.updateContainer(null, root, null, null);
    },
  };
}

// @ts-expect-error globalThis
globalThis.renderPage = function() {
  page = __CreatePage('0', 0);
  pageId = __GetElementUniqueID(page);
  root = createRoot(page);
  root.render(code());
};
// @ts-expect-error globalThis
globalThis.updatePage = function() {};
// @ts-expect-error globalThis
globalThis.processData = function() {};

export function setRootComponent(c: () => ReactNode): void {
  console.log("[gcc]",c.toString());
  code = c;
}
