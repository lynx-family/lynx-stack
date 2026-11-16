// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { resolveParcelBundle } from './bundle.js';
import type {
  DispatchParcelBackground,
  LoadedParcel,
  ParcelExports,
  ParcelSource,
} from './types.js';
import { parcelSections } from '../../common/index.js';

/**
 * Load an artifact on the main thread and return its unmounted UI.
 *
 * The host supplies its background dispatcher. The returned handle and
 * promises stay on the main thread. The host can mount before
 * `backgroundReady` settles.
 */
export function loadParcel<Data>(
  source: ParcelSource,
  dispatchBackground: DispatchParcelBackground,
): Promise<LoadedParcel<Data>> {
  const context = lynx.getJSContext();
  const engine = lynx.getEngine();
  const sections = parcelSections(source.sectionPrefix);
  const replyEvent = `LynxParcel:ready:${Date.now()}:${Math.random()}`;
  let destroyed = false;
  let rejectBackground!: (error: Error) => void;
  let rejectMain!: (error: Error) => void;

  const onDestroy = () => {
    destroyed = true;
    rejectBackground(new Error('Parcel background initialization cancelled'));
    rejectMain(new Error('Parcel load cancelled'));
  };
  const background = new Promise<void>((resolve, reject) => {
    const onReady = (event: { data: { ok: boolean; error?: string } }) => {
      context.removeEventListener(replyEvent, onReady);
      if (event.data.ok) {
        resolve();
      } else {
        reject(
          new Error(
            event.data.error ?? 'Parcel background initialization failed',
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

  const main = new Promise<LoadedParcel<Data>>((resolve, reject) => {
    rejectMain = reject;
    void resolveParcelBundle(source).then(bundleName => {
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
        throw new Error(`Missing parcel stylesheet: ${sections.css}`);
      }
      const artifact = lynx.loadScript<ParcelExports<Data>>(
        sections.main,
        { bundleName },
      );
      if (
        typeof artifact?.mount !== 'function'
        || typeof artifact.update !== 'function'
        || typeof artifact.unmount !== 'function'
      ) {
        throw new Error(`Missing parcel lifecycle exports: ${sections.main}`);
      }
      styleGlobals.__AdoptStyleSheet(stylesheet);
      const backgroundReady = background.then(() => {
        if (destroyed) {
          throw new Error('Parcel background initialization cancelled');
        }
        artifact.setBackgroundReady?.();
      });
      // Attach a rejection handler even for hosts that only use the main UI.
      void backgroundReady.catch(() => {
        // The handle still exposes the original promise.
      });
      resolve({
        mount: artifact.mount,
        update: artifact.update,
        unmount: artifact.unmount,
        backgroundReady,
      });
    }).catch((error: unknown) => {
      const reason = asError(error);
      rejectBackground(reason);
      reject(reason);
    });
  });

  engine.addEventListener('__DestroyLifetime', onDestroy);
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
  return main;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
