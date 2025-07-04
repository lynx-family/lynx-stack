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

const eventRegExp =
  /^(bind|catch|capture-bind|capture-catch|global-bind)([A-Za-z]+)$/;

const eventTypeMap: Record<string, string> = {
  bind: 'bindEvent',
  catch: 'catchEvent',
  'capture-bind': 'capture-bind',
  'capture-catch': 'capture-catch',
  'global-bind': 'global-bindEvent',
};

// let nextReactTag = 3;
// function allocateTag() {
//   let tag = nextReactTag;
//   if (tag % 10 === 1) {
//     tag += 2;
//   }
//   nextReactTag = tag + 2;
//   return tag;
// }

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
  createInstance(type: Type, props: Props) {
    const el = __CreateElement(type, pageId!);
    console.log('createInstance props', type, props);
    Object.entries(props).forEach(([key, value]) => {
      let hasMainThreadPrefix = false;
      if (key.startsWith('main-thread:')) {
        hasMainThreadPrefix = true;
        key = key.slice(12);
      }
      let match: RegExpMatchArray | null = null;

      if (key === 'class' || key === 'classname') {
        __SetClasses(el, value);
      } else if (key === 'style') {
        __SetInlineStyles(el, value);
      } else if ((match = key.match(eventRegExp))) {
        const eventType = eventTypeMap[match[1]!]!;
        const eventName = match[2]!;
        if (hasMainThreadPrefix) {
          __AddEvent(el, eventType, eventName, {
            type: 'worklet',
            value,
          });
        } else {
          lynx.reportError(
            'Event binding is only supported with main-thread prefix',
          );
        }
      } else if (key === 'src') {
        __SetAttribute(el, key, value);
      }
    });
    return el;
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
    return {};
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
  commitUpdate(
    _instance: FiberElement,
    type: Type,
    oldProps: Props,
    newProps: Props,
    _internalInstanceHandle: Object,
  ): void {
    console.log('commitUpdate', type, oldProps, newProps);
    // __FlushElementTree();
  },
  commitTextUpdate(
    textInstance: FiberElement,
    _oldText: string,
    newText: string,
  ) {
    console.log('commitTextUpdate', _oldText, newText);
    __SetAttribute(textInstance, 'text', newText);
    __FlushElementTree();
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
  root.render(code);
  setTimeout(() => {
    __FlushElementTree();
  }, 10);
};
// @ts-expect-error globalThis
globalThis.updatePage = function() {};
// @ts-expect-error globalThis
globalThis.processData = function() {};
// @ts-expect-error globalThis
globalThis.runWorklet = function(value, params) {
  if (typeof value === 'function') {
    value(...params);
  }
};

export function setRootComponent(c: () => ReactNode): void {
  code = c;
}
