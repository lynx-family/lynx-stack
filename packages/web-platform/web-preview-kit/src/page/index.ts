// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The entry of the kit page: the handshake with the parent window, the
 * environment checks, the Service Worker, the bundler worker and the session.
 */

import '@lynx-js/web-core/client';

import type {
  BuiltinPackages,
  EventName,
  Events,
  HandshakeMessage,
  KitMessage,
  ReadyMessage,
} from '../protocol.js';
import { PROTOCOL_CHANNEL, PROTOCOL_VERSION } from '../protocol.js';
import { cacheNameOf, publicPathOf } from '../shared/assets.js';
import type { ServiceWorkerMessage } from '../shared/sw-messages.js';
import { CacheAssetStore } from './assetStore.js';
import { CardView } from './cardView.js';
import { RequestRouter } from './router.js';
import type { BundlerClient, Support } from './session.js';
import { Session } from './session.js';
import { WorkerBundler } from './workerBundler.js';

/** How long the page waits for the Service Worker and the bundler worker. */
const STARTUP_TIMEOUT_MS = 30_000;

const instanceId = crypto.randomUUID();
const scope = new URL('./', location.href).href;
const publicPath = publicPathOf(scope, instanceId);
const cacheName = cacheNameOf(instanceId);

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${what} timed out`)),
      STARTUP_TIMEOUT_MS,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Registers the Service Worker and waits until it controls this page, so
 * that every `<lynx-view>` and worker created afterwards is served by it.
 */
async function startServiceWorker(): Promise<void> {
  const container = navigator.serviceWorker;
  await container.register(new URL('sw.js', scope), {
    scope,
    type: 'module',
    updateViaCache: 'none',
  });
  const registration = await container.ready;
  const controlled = container.controller
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
      container.addEventListener('controllerchange', () => resolve(), {
        once: true,
      });
    });
  // Records this page as the owner of its instance; the Service Worker also
  // claims the page, which matters after a reload that bypassed it.
  const claimed = new Promise<void>((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => resolve();
    const message: ServiceWorkerMessage = { type: 'claim', instanceId };
    registration.active!.postMessage(message, [port2]);
  });
  await claimed;
  await controlled;
}

interface Environment {
  support: Support;
  builtinPackages: BuiltinPackages;
  bundler?: WorkerBundler;
}

async function prepare(): Promise<Environment> {
  const unsupported = (reason: string): Environment => ({
    support: { supported: false, reason },
    builtinPackages: {},
  });
  if (!globalThis.crossOriginIsolated) {
    return unsupported(
      'The kit is not cross-origin isolated. Embed it from a cross-origin isolated page with allow="cross-origin-isolated", or serve it with Document-Isolation-Policy: isolate-and-require-corp.',
    );
  }
  if (!('serviceWorker' in navigator)) {
    return unsupported(
      'Service Workers are not available. The kit needs its own origin, so an iframe sandbox must allow scripts and same-origin.',
    );
  }
  try {
    await withTimeout(startServiceWorker(), 'Starting the Service Worker');
  } catch (error) {
    return unsupported(`Cannot start the Service Worker: ${String(error)}`);
  }
  const bundler = new WorkerBundler(
    new Worker(new URL('bundler-worker.js', scope), {
      type: 'module',
      name: 'lynx-preview-bundler',
    }),
  );
  try {
    const builtinPackages = await withTimeout(
      bundler.ready,
      'Starting the bundler worker',
    );
    return { support: { supported: true }, builtinPackages, bundler };
  } catch (error) {
    return unsupported(String(error));
  }
}

/** Fails every bundler call; used when the kit cannot build. */
const unavailableBundler: BundlerClient = {
  start: () => Promise.reject(new Error('The bundler is not available.')),
  apply: () => Promise.reject(new Error('The bundler is not available.')),
  read: () => Promise.reject(new Error('The bundler is not available.')),
  list: () => Promise.reject(new Error('The bundler is not available.')),
  close: () => Promise.resolve(),
};

let port: MessagePort | undefined;

function emit<E extends EventName>(event: E, data: Events[E]): void {
  const message: KitMessage = { event, data } as KitMessage;
  port?.postMessage(message);
}

const sessionReady: Promise<{ session: Session; router: RequestRouter }> =
  prepare().then((environment) => {
    const container = document.getElementById('preview') ?? document.body;
    let session: Session | undefined;
    const host = new CardView(container, {
      onReloadRequest: () => session?.reloadRequested(),
      onError: error => session?.cardError(error),
    });
    session = new Session({
      support: environment.support,
      builtinPackages: environment.builtinPackages,
      publicPath,
      cacheName,
      bundler: environment.bundler ?? unavailableBundler,
      assets: new CacheAssetStore(cacheName, publicPath),
      host,
      emit,
    });
    environment.bundler?.listen(session);
    return { session, router: new RequestRouter(session.handlers) };
  });

function connect(next: MessagePort): void {
  port?.close();
  port = next;
  const current = next;
  void sessionReady.then(({ session }) => {
    current.postMessage(
      { event: 'hello', data: session.hello } satisfies KitMessage,
    );
  });
  current.onmessage = (event: MessageEvent<unknown>) => {
    void sessionReady.then(({ router }) => {
      router.receive(event.data, response => current.postMessage(response));
    });
  };
}

function announce(): void {
  if (window.parent === window) {
    return;
  }
  const ready: ReadyMessage = {
    channel: PROTOCOL_CHANNEL,
    type: 'ready',
    versions: [PROTOCOL_VERSION],
  };
  window.parent.postMessage(ready, '*');
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const message = event.data as Partial<HandshakeMessage> | null;
  if (
    typeof message !== 'object' || message === null
    || message.channel !== PROTOCOL_CHANNEL
    || event.source !== window.parent || window.parent === window
  ) {
    return;
  }
  if (message.type === 'probe') {
    announce();
  } else if (message.type === 'connect') {
    const next = event.ports[0];
    if (message.version !== PROTOCOL_VERSION || event.ports.length !== 1) {
      console.warn(
        '[web-preview-kit] ignored a connect message with an unsupported version or without exactly one port',
      );
      return;
    }
    connect(next!);
  }
});

window.addEventListener('pagehide', () => {
  // Best effort; the Service Worker removes the caches of gone pages too.
  // `caches` throws where the page has no origin of its own.
  try {
    void caches.delete(cacheName).catch(() => {});
  } catch {
    // nothing to clean up
  }
});

announce();
