// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { dispatchIslandBackground } from './background-bridge.js';
import type {
  DispatchIslandBackground,
  IslandModule,
  IslandReference,
  LoadedIslandModule,
} from './types.js';
import { islandSections } from '../shared/index.js';

/**
 * Synchronously load an exposed module from the current host bundle without creating a UI instance.
 *
 * Resource loading errors throw synchronously. The returned factory and its
 * `backgroundReady` promise stay on the main thread. Instances can render before
 * background initialization finishes.
 *
 * @param source - Exposed module in the current host bundle.
 * @param dispatchBackground - Host background dispatcher; defaults to the native Lynx context bridge.
 * @internal
 */
export function loadIslandModule<Data>(
  source: IslandReference,
  dispatchBackground: DispatchIslandBackground = dispatchIslandBackground,
): LoadedIslandModule<Data> {
  const sections = islandSections(source.expose);
  const styleGlobals = globalThis as typeof globalThis & {
    __LoadStyleSheet?: (section: string, bundleName: string) => unknown;
    __AdoptStyleSheet: (stylesheet: unknown) => void;
  };
  if (typeof styleGlobals.__LoadStyleSheet !== 'function') {
    throw new Error('__LoadStyleSheet requires Lynx SDK 3.7 or newer');
  }
  const stylesheet = styleGlobals.__LoadStyleSheet(sections.css, '__Card__');
  if (stylesheet == null) {
    throw new Error(`Missing island stylesheet: ${sections.css}`);
  }
  const artifact = lynx.loadScript<IslandModule<Data>>(
    sections.main,
    { bundleName: '__Card__' },
  );
  if (typeof artifact?.create !== 'function') {
    throw new Error(`Missing island module factory: ${sections.main}`);
  }
  styleGlobals.__AdoptStyleSheet(stylesheet);

  const context = lynx.getJSContext();
  const engine = lynx.getEngine();
  const replyEvent = `LynxIsland:ready:${Date.now()}:${Math.random()}`;
  let destroyed = false;
  let rejectBackground!: (error: Error) => void;
  let onReady!: (event: { data: { ok: boolean; error?: string } }) => void;
  const onDestroy = () => {
    destroyed = true;
    rejectBackground(new Error('Island background initialization cancelled'));
  };
  const background = new Promise<void>((resolve, reject) => {
    rejectBackground = reject;
    onReady = event => {
      if (event.data.ok) resolve();
      else {reject(
          new Error(
            event.data.error ?? 'Island background initialization failed',
          ),
        );}
    };
    context.addEventListener(replyEvent, onReady);
    engine.addEventListener('__DestroyLifetime', onDestroy);
  });
  const backgroundReady = background.then(() => {
    if (destroyed) {
      throw new Error('Island background initialization cancelled');
    }
  });
  const cleanup = () => {
    context.removeEventListener(replyEvent, onReady);
    engine.removeEventListener('__DestroyLifetime', onDestroy);
  };
  // Also observe rejection when a host only uses the main-thread UI.
  void backgroundReady.then(cleanup, cleanup);
  try {
    void Promise.resolve(dispatchBackground(source, replyEvent)).catch(
      (error: unknown) => rejectBackground(asError(error)),
    );
  } catch (error) {
    rejectBackground(asError(error));
  }
  return { create: () => artifact.create(), backgroundReady };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
