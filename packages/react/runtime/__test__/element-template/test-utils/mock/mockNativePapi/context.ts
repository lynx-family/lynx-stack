import { afterEach, vi } from 'vitest';

export interface ContextEvent {
  type: string;
  data: unknown;
}

type ContextListener = (event: ContextEvent) => void;

export interface ContextEventTarget {
  addEventListener(type: string, listener: ContextListener): void;
  removeEventListener(type: string, listener: ContextListener): void;
  dispatchEvent(event: ContextEvent): number;
  postMessage(message: unknown): void;
}

interface ContextQueues {
  jsQueue: ContextEvent[];
  coreQueue: ContextEvent[];
  jsListeners: Map<string, Set<ContextListener>>;
  coreListeners: Map<string, Set<ContextListener>>;
}

interface ActiveListener {
  type: string;
  listener: ContextListener;
  stack: string;
}

let currentQueues: ContextQueues | undefined;

function getCurrentStackTrace(): string {
  return new Error().stack?.split('\n').slice(2).join('\n') ?? '';
}

function flush(queue: ContextEvent[], listeners: Map<string, Set<ContextListener>>): void {
  if (queue.length === 0) {
    return;
  }

  const events = queue.splice(0);
  for (const event of events) {
    const typeListeners = listeners.get(event.type);
    if (!typeListeners) {
      continue;
    }

    for (const listener of typeListeners) {
      listener(event);
    }
  }
}

export function flushJSContextEvents(): void {
  if (!currentQueues) {
    return;
  }
  flush(currentQueues.jsQueue, currentQueues.jsListeners);
}

export function flushCoreContextEvents(): void {
  if (!currentQueues) {
    return;
  }
  flush(currentQueues.coreQueue, currentQueues.coreListeners);
}

function trackListener(
  store: Map<string, Set<ContextListener>>,
  activeSet: Set<ActiveListener>,
  type: string,
  listener: ContextListener,
): void {
  const listeners = store.get(type);
  if (listeners?.has(listener)) {
    return;
  }

  activeSet.add({ type, listener, stack: getCurrentStackTrace() });

  if (listeners) {
    listeners.add(listener);
    return;
  }

  store.set(type, new Set([listener]));
}

function untrackListener(
  store: Map<string, Set<ContextListener>>,
  activeSet: Set<ActiveListener>,
  type: string,
  listener: ContextListener,
): void {
  const listeners = store.get(type);
  if (!listeners) {
    return;
  }

  const existed = listeners.delete(listener);
  if (existed) {
    for (const item of activeSet) {
      if (item.type === type && item.listener === listener) {
        activeSet.delete(item);
        break;
      }
    }
  }

  if (listeners.size === 0) {
    store.delete(type);
  }
}

function formatActiveListeners(activeListeners: Set<ActiveListener>): string {
  let message = '';
  for (const item of activeListeners) {
    message += `  - [${item.type}] added at:\n${item.stack}\n`;
  }
  return message;
}

type ThreadType = 'main' | 'background';

type ThreadFlags = typeof globalThis & {
  __LEPUS__?: boolean;
  __JS__?: boolean;
  __MAIN_THREAD__?: boolean;
  __BACKGROUND__?: boolean;
};

type ContextMethod = keyof ContextEventTarget;

type ContextName = 'jsContext' | 'coreContext';

function detectCurrentThread(): ThreadType | undefined {
  const flags = globalThis as ThreadFlags;

  // Many test setups initialize both sides at module-load time, so thread flags
  // can be ambiguous (both true). Only enforce when the state is unambiguous.
  if (flags.__MAIN_THREAD__ === true && flags.__BACKGROUND__ === true) {
    return undefined;
  }
  if (flags.__MAIN_THREAD__ === false && flags.__BACKGROUND__ === false) {
    return undefined;
  }

  if (flags.__MAIN_THREAD__ === true) {
    return 'main';
  }
  if (flags.__BACKGROUND__ === true) {
    return 'background';
  }

  if (flags.__LEPUS__ === true && flags.__JS__ === true) {
    return undefined;
  }
  if (flags.__LEPUS__ === false && flags.__JS__ === false) {
    return undefined;
  }

  if (flags.__LEPUS__ === true) {
    return 'main';
  }
  if (flags.__JS__ === true) {
    return 'background';
  }
  if (flags.__LEPUS__ === false) {
    return 'background';
  }
  if (flags.__JS__ === false) {
    return 'main';
  }

  return undefined;
}

function assertThreadAccess(context: ContextName, method: ContextMethod, allowed: ThreadType): void {
  const current = detectCurrentThread();
  if (!current) {
    return;
  }
  if (current !== allowed) {
    throw new Error(
      `Thread context violation: ${context}.${
        String(method)
      } can only be called on ${allowed} thread (current: ${current}).`,
    );
  }
}

function createContextEventTarget(options: {
  contextName: ContextName;
  allowedThread: ThreadType;
  listeners: Map<string, Set<ContextListener>>;
  activeListeners: Set<ActiveListener>;
  outboundQueue: ContextEvent[];
}): ContextEventTarget {
  return {
    addEventListener: (type, listener) => {
      assertThreadAccess(options.contextName, 'addEventListener', options.allowedThread);
      trackListener(options.listeners, options.activeListeners, type, listener);
    },
    removeEventListener: (type, listener) => {
      assertThreadAccess(options.contextName, 'removeEventListener', options.allowedThread);
      untrackListener(options.listeners, options.activeListeners, type, listener);
    },
    dispatchEvent: (event) => {
      assertThreadAccess(options.contextName, 'dispatchEvent', options.allowedThread);
      options.outboundQueue.push(event);
      return 0;
    },
    postMessage: (message) => {
      assertThreadAccess(options.contextName, 'postMessage', options.allowedThread);
      options.outboundQueue.push({ type: 'message', data: message });
    },
  };
}

export function createCrossThreadContextPair(): {
  jsContext: ContextEventTarget;
  coreContext: ContextEventTarget;
  checkListenerLeaks: () => void;
} {
  const jsListeners = new Map<string, Set<ContextListener>>();
  const coreListeners = new Map<string, Set<ContextListener>>();
  const jsQueue: ContextEvent[] = [];
  const coreQueue: ContextEvent[] = [];

  const activeJSListeners = new Set<ActiveListener>();
  const activeCoreListeners = new Set<ActiveListener>();

  currentQueues = {
    jsQueue,
    coreQueue,
    jsListeners,
    coreListeners,
  };

  const checkListenerLeaks = (): void => {
    let errorMsg = '';

    if (activeJSListeners.size > 0) {
      errorMsg += `Event listener leak detected in JS Context (${activeJSListeners.size} leaks):\n`;
      errorMsg += formatActiveListeners(activeJSListeners);
    }

    if (activeCoreListeners.size > 0) {
      errorMsg += `Event listener leak detected in Core Context (${activeCoreListeners.size} leaks):\n`;
      errorMsg += formatActiveListeners(activeCoreListeners);
    }

    if (errorMsg) {
      throw new Error(errorMsg);
    }
  };

  const jsContext = createContextEventTarget({
    contextName: 'jsContext',
    allowedThread: 'main',
    listeners: jsListeners,
    activeListeners: activeJSListeners,
    outboundQueue: coreQueue,
  });

  const coreContext = createContextEventTarget({
    contextName: 'coreContext',
    allowedThread: 'background',
    listeners: coreListeners,
    activeListeners: activeCoreListeners,
    outboundQueue: jsQueue,
  });

  return { jsContext, coreContext, checkListenerLeaks };
}

let isThreadContextInstalled = false;
let currentCheckListenerLeaks: (() => void) | undefined;

type GlobalWithLynx = typeof globalThis & { lynx?: unknown };

export function installThreadContexts(): void {
  const { jsContext, coreContext, checkListenerLeaks } = createCrossThreadContextPair();
  currentCheckListenerLeaks = checkListenerLeaks;

  const currentLynx = (globalThis as GlobalWithLynx).lynx;
  const baseLynx = currentLynx && typeof currentLynx === 'object'
    ? (currentLynx as Record<string, unknown>)
    : {};

  vi.stubGlobal('lynx', {
    ...baseLynx,
    getJSContext: () => jsContext,
    getCoreContext: () => coreContext,
  });

  if (isThreadContextInstalled) {
    return;
  }

  isThreadContextInstalled = true;
  afterEach(() => {
    currentCheckListenerLeaks?.();
  });
}
