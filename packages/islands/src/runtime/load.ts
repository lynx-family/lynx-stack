// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { dispatchIslandBackground } from './background-bridge.js';
import { resolveIslandEntry } from './resolve-entry.js';
import type {
  DispatchIslandBackground,
  IslandModule,
  IslandReference,
  LoadedIslandModule,
} from './types.js';
import { islandSections } from '../shared/index.js';

/**
 * Load an exposed island module without creating a UI instance.
 *
 * The returned factory and promises stay on the main thread. Instances can render before
 * `backgroundReady` settles.
 *
 * @param source - Exposed module and optional remote entry.
 * @param dispatchBackground - Host background dispatcher; defaults to the native Lynx context bridge.
 * @public
 */
export function loadIslandModule<Data>(
  source: IslandReference,
  dispatchBackground: DispatchIslandBackground = dispatchIslandBackground,
): Promise<LoadedIslandModule<Data>> {
  return Promise.resolve(
    loadIslandModuleForRender<Data>(source, dispatchBackground),
  );
}

// Inline sections already belong to the host bundle. Keep their evaluation on
// the current main-thread stack so a ref can render before the first flush.
export function loadIslandModuleForRender<Data>(
  source: IslandReference,
  dispatchBackground: DispatchIslandBackground = dispatchIslandBackground,
): LoadedIslandModule<Data> | Promise<LoadedIslandModule<Data>> {
  const context = lynx.getJSContext();
  const engine = lynx.getEngine();
  const sections = islandSections(source.expose);
  const replyEvent = `LynxIsland:ready:${Date.now()}:${Math.random()}`;
  let destroyed = false;
  let rejectBackground!: (error: Error) => void;
  let rejectMain!: (error: Error) => void;
  let inlineModule: LoadedIslandModule<Data> | undefined;

  const onDestroy = () => {
    destroyed = true;
    rejectBackground(new Error('Island background initialization cancelled'));
    rejectMain(new Error('Island module load cancelled'));
  };
  const background = new Promise<void>((resolve, reject) => {
    const onReady = (event: { data: { ok: boolean; error?: string } }) => {
      context.removeEventListener(replyEvent, onReady);
      if (event.data.ok) {
        resolve();
      } else {
        reject(
          new Error(
            event.data.error ?? 'Island background initialization failed',
          ),
        );
      }
    };
    rejectBackground = error => {
      context.removeEventListener(replyEvent, onReady);
      reject(error);
    };
    context.addEventListener(replyEvent, onReady);
  });

  const main = new Promise<LoadedIslandModule<Data>>((resolve, reject) => {
    rejectMain = reject;
    engine.addEventListener('__DestroyLifetime', onDestroy);
    const fail = (error: unknown) => {
      const reason = asError(error);
      rejectBackground(reason);
      reject(reason);
    };
    const evaluate = (bundleName: string) => {
      if (destroyed) return;
      const styleGlobals = globalThis as typeof globalThis & {
        __LoadStyleSheet?: (section: string, bundleName: string) => unknown;
        __AdoptStyleSheet: (stylesheet: unknown) => void;
      };
      if (typeof styleGlobals.__LoadStyleSheet !== 'function') {
        throw new Error('__LoadStyleSheet requires Lynx SDK 3.7 or newer');
      }
      const stylesheet = styleGlobals.__LoadStyleSheet(
        sections.css,
        bundleName,
      );
      if (stylesheet == null) {
        throw new Error(`Missing island stylesheet: ${sections.css}`);
      }
      const artifact = lynx.loadScript<IslandModule<Data>>(
        sections.main,
        { bundleName },
      );
      if (typeof artifact?.create !== 'function') {
        throw new Error(`Missing island module factory: ${sections.main}`);
      }
      styleGlobals.__AdoptStyleSheet(stylesheet);
      const backgroundReady = background.then(() => {
        if (destroyed) {
          throw new Error('Island background initialization cancelled');
        }
      });
      // Attach a rejection handler even for hosts that only use the main UI.
      void backgroundReady.catch(() => {
        // The handle still exposes the original promise.
      });
      const module = {
        create: () => artifact.create(),
        backgroundReady,
      };
      if (source.entry === undefined) inlineModule = module;
      resolve(module);
    };
    if (source.entry === undefined) {
      try {
        evaluate('__Card__');
      } catch (error) {
        fail(error);
      }
    } else {
      void resolveIslandEntry(source).then(evaluate).catch(fail);
    }
  });

  try {
    void Promise.resolve(dispatchBackground(source, replyEvent)).catch(
      (error: unknown) => {
        rejectBackground(asError(error));
      },
    );
  } catch (error) {
    rejectBackground(asError(error));
  }

  // Retain the page listener until both operations finish, even if either
  // fails early. Nothing should evaluate in a destroyed page's context.
  let pending = 2;
  const settled = () => {
    if (--pending === 0) {
      engine.removeEventListener('__DestroyLifetime', onDestroy);
    }
  };
  void main.then(settled, settled);
  void background.then(settled, settled);
  return inlineModule ?? main;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
