// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  ELEMENT_TEMPLATE_COMMIT_EVENT,
  ElementTemplateCommandReceiver,
  createRemoteElementTemplateRuntime,
} from '@lynx-js/element-template-runtime';
import type {
  BackgroundElementTemplateChannel,
  ElementTemplateBridgeCommit,
  MainElementTemplateChannel,
} from '@lynx-js/element-template-runtime';
import {
  initializeBackgroundThread,
  initializeMainThread,
} from '@lynx-js/lynx-runtime';

import {
  createNativeElementTemplateApi,
  createPageElementTemplate,
} from './native.js';
import type { SolidLynxElementTemplateHandle } from './native.js';
import type { SolidLynxNode, SolidLynxRendererContext } from './renderer.js';

const SOLID_READY_EVENT = 'Lynx.Solid.ready';

interface MainToBackgroundEvents {
  [SOLID_READY_EVENT]: undefined;
}

interface BackgroundToMainEvents {
  [ELEMENT_TEMPLATE_COMMIT_EVENT]: ElementTemplateBridgeCommit;
}

interface SolidLynxApp {
  publicComponentEvent?: (
    componentId: string,
    eventToken: string,
    event: unknown,
  ) => void;
  publishEvent?: (eventToken: string, event: unknown) => void;
}

interface SolidLynxHost {
  getApp(): SolidLynxApp;
}

type SolidLynxRender = (
  context: SolidLynxRendererContext,
  component: () => SolidLynxNode,
) => unknown;

declare const lynx: SolidLynxHost;

function describeInitialCommitMismatch(
  current: ElementTemplateBridgeCommit,
  background: ElementTemplateBridgeCommit,
): string {
  const length = Math.max(
    current.commands.length,
    background.commands.length,
  );
  for (let index = 0; index < length; index += 1) {
    const currentCommand = current.commands[index];
    const backgroundCommand = background.commands[index];
    if (
      JSON.stringify(currentCommand) !== JSON.stringify(backgroundCommand)
    ) {
      const start = Math.max(0, index - 3);
      const end = index + 4;
      return `command ${index}: current=${
        JSON.stringify(currentCommand)
      }, background=${JSON.stringify(backgroundCommand)}, current context=${
        JSON.stringify(current.commands.slice(start, end))
      }, background context=${
        JSON.stringify(background.commands.slice(start, end))
      }`;
    }
  }
  return 'commit metadata differs';
}

class DisposeScope {
  readonly #listeners = new Set<() => void>();
  #disposed = false;

  public add(listener: () => void): () => void {
    if (this.#disposed) {
      listener();
      return () => undefined;
    }

    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  public dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    for (const listener of this.#listeners) {
      listener();
    }
    this.#listeners.clear();
  }
}

function initializeMainThreadRoot(
  component: () => unknown,
  render: SolidLynxRender,
): void {
  const disposeScope = new DisposeScope();
  let receiver:
    | ElementTemplateCommandReceiver<SolidLynxElementTemplateHandle>
    | undefined;

  const runtime = initializeMainThread<
    MainToBackgroundEvents,
    BackgroundToMainEvents
  >({
    onDestroy() {
      receiver?.dispose();
      receiver = undefined;
      disposeScope.dispose();
    },
    onRenderPage() {
      receiver?.dispose();
      let initialCommit: ElementTemplateBridgeCommit | undefined;
      let awaitingBackgroundInitialCommit = true;
      const channel: MainElementTemplateChannel = {
        onDispose: listener => disposeScope.add(listener),
        onRemote: (_type, listener) => {
          return runtime.onBackgroundEvent(
            ELEMENT_TEMPLATE_COMMIT_EVENT,
            commit => {
              if (awaitingBackgroundInitialCommit) {
                awaitingBackgroundInitialCommit = false;
                if (
                  initialCommit === undefined
                  || JSON.stringify(initialCommit) !== JSON.stringify(commit)
                ) {
                  const detail = initialCommit === undefined
                    ? 'main-thread commit is missing'
                    : describeInitialCommitMismatch(initialCommit, commit);
                  throw new Error(
                    `SolidLynx main and background initial renders produced different Element Template commands: ${detail}.`,
                  );
                }
                return;
              }
              listener(commit);
            },
          );
        },
      };
      receiver = new ElementTemplateCommandReceiver(
        channel,
        createNativeElementTemplateApi(),
        createPageElementTemplate(),
      );
      const localChannel: BackgroundElementTemplateChannel = {
        dispatchToRemote(_type, commit) {
          if (initialCommit !== undefined) {
            throw new Error(
              'SolidLynx main-thread initial render must produce one commit.',
            );
          }
          initialCommit = commit;
          receiver?.apply(commit.commands);
        },
        onDispose: listener => disposeScope.add(listener),
      };
      const context: SolidLynxRendererContext = {
        eventHandlers: new Map(),
        remote: createRemoteElementTemplateRuntime(localChannel),
      };
      render(context, component as () => SolidLynxNode);
      context.eventHandlers.clear();
      if (initialCommit === undefined) {
        throw new Error(
          'SolidLynx main-thread initial render did not produce a commit.',
        );
      }
      runtime.dispatchToBackground(SOLID_READY_EVENT, undefined);
    },
  });
}

function installBackgroundEventDispatcher(
  context: SolidLynxRendererContext,
): () => void {
  const app = lynx.getApp();
  const previousPublishEvent = app.publishEvent;
  const previousPublicComponentEvent = app.publicComponentEvent;
  const publishEvent = (eventToken: string, event: unknown): void => {
    context.remote.api.batch(() => {
      context.eventHandlers.get(eventToken)?.(event);
    });
  };

  app.publishEvent = publishEvent;
  app.publicComponentEvent = (_componentId, eventToken, event) => {
    publishEvent(eventToken, event);
  };

  return () => {
    if (previousPublishEvent === undefined) {
      delete app.publishEvent;
    } else {
      app.publishEvent = previousPublishEvent;
    }
    if (previousPublicComponentEvent === undefined) {
      delete app.publicComponentEvent;
    } else {
      app.publicComponentEvent = previousPublicComponentEvent;
    }
  };
}

function initializeBackgroundRoot(
  component: () => unknown,
  render: SolidLynxRender,
): void {
  const disposeScope = new DisposeScope();
  let disposeRenderer: (() => void) | undefined;
  let restoreEventDispatcher: (() => void) | undefined;

  const runtime = initializeBackgroundThread<
    BackgroundToMainEvents,
    MainToBackgroundEvents
  >({
    onDestroy() {
      disposeRenderer?.();
      disposeRenderer = undefined;
      restoreEventDispatcher?.();
      restoreEventDispatcher = undefined;
      disposeScope.dispose();
    },
  });
  const channel: BackgroundElementTemplateChannel = {
    dispatchToRemote: (_type, commit) => {
      runtime.dispatchToMainThread(ELEMENT_TEMPLATE_COMMIT_EVENT, commit);
    },
    onDispose: listener => disposeScope.add(listener),
  };

  runtime.onMainThreadEvent(SOLID_READY_EVENT, () => {
    if (disposeRenderer !== undefined) {
      return;
    }

    const remote = createRemoteElementTemplateRuntime(channel);
    const context: SolidLynxRendererContext = {
      eventHandlers: new Map(),
      remote,
    };
    restoreEventDispatcher = installBackgroundEventDispatcher(context);
    const result = render(
      context,
      component as () => SolidLynxNode,
    );
    if (typeof result !== 'function') {
      throw new Error('SolidLynx background renderer must return a disposer.');
    }
    disposeRenderer = result as () => void;
  });
}

export interface Root {
  render(component: () => unknown): void;
}

export type SolidLynxThread = 'background' | 'main-thread';

export function createRoot(
  thread: 'main-thread',
  render: SolidLynxRender,
): Root;
export function createRoot(
  thread: 'background',
  render: SolidLynxRender,
): Root;
export function createRoot(
  thread: SolidLynxThread,
  render: SolidLynxRender,
): Root {
  let rendered = false;

  return {
    render(component): void {
      if (rendered) {
        throw new Error('SolidLynx root.render() can only be called once.');
      }
      rendered = true;

      if (thread === 'main-thread') {
        initializeMainThreadRoot(component, render);
      } else {
        initializeBackgroundRoot(component, render);
      }
    },
  };
}
