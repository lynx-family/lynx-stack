// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BuildReport,
  WorkerCommand,
  WorkerEvent,
} from '../worker/messages.js';

/** Receives the build events of the bundler worker. */
export interface BuildListener {
  buildStarted(generation: number, revision: number): void;
  buildDone(generation: number, revision: number, report: BuildReport): void;
}

/** The page's handle on the bundler worker, `bundler-worker.js` next to the page. */
export class Bundler {
  readonly #worker = new Worker(new URL('bundler-worker.js', location.href), {
    type: 'module',
  });
  readonly #pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  #nextId = 1;

  constructor(listener: BuildListener) {
    this.#worker.addEventListener(
      'message',
      ({ data }: MessageEvent<WorkerEvent>) => {
        switch (data.type) {
          case 'reply': {
            const pending = this.#pending.get(data.id)!;
            this.#pending.delete(data.id);
            if (data.error === undefined) {
              pending.resolve(data.result);
            } else {
              pending.reject(new Error(data.error));
            }
            break;
          }
          case 'build-start':
            listener.buildStarted(data.generation, data.revision);
            break;
          case 'build-done':
            listener.buildDone(data.generation, data.revision, data.report);
            break;
        }
      },
    );
  }

  /** Sends a command and resolves to the worker's reply. */
  call<T = undefined>(command: WorkerCommand): Promise<T> {
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.#worker.postMessage({ ...command, id });
    });
  }
}
