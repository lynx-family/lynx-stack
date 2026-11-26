// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BuiltinPackages, FileChange, FileMap } from '../protocol.js';
import type {
  BuildReport,
  BundlerConfig,
  WorkerCommand,
  WorkerEvent,
} from '../worker/messages.js';
import type { BundlerClient } from './session.js';

/** Receives the build events of the worker. */
export interface BuildListener {
  buildStarted(generation: number, revision: number): void;
  buildDone(generation: number, revision: number, report: BuildReport): void;
}

/** Distributes a {@link WorkerCommand} without its `id`. */
type Command = WorkerCommand extends infer C
  ? C extends WorkerCommand ? Omit<C, 'id'> : never
  : never;

/** A {@link BundlerClient} that talks to the bundler worker. */
export class WorkerBundler implements BundlerClient {
  readonly #worker: Worker;
  readonly #pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  #nextId = 1;
  #listener: BuildListener | undefined;
  readonly ready: Promise<BuiltinPackages>;

  constructor(worker: Worker) {
    this.#worker = worker;
    this.ready = new Promise((resolve, reject) => {
      worker.addEventListener('error', (event) => {
        const error = new Error(
          `The bundler worker failed: ${event.message || 'it did not load'}`,
        );
        reject(error);
        for (const pending of this.#pending.values()) {
          pending.reject(error);
        }
        this.#pending.clear();
      });
      worker.addEventListener('message', (event: MessageEvent<WorkerEvent>) => {
        const message = event.data;
        switch (message.type) {
          case 'ready':
            if (message.error === undefined) {
              resolve(message.builtinPackages);
            } else {
              reject(new Error(message.error));
            }
            break;
          case 'reply': {
            const pending = this.#pending.get(message.id);
            this.#pending.delete(message.id);
            if (message.error === undefined) {
              pending?.resolve(message.result);
            } else {
              pending?.reject(new Error(message.error));
            }
            break;
          }
          case 'build-start':
            this.#listener?.buildStarted(message.generation, message.revision);
            break;
          case 'build-done':
            this.#listener?.buildDone(
              message.generation,
              message.revision,
              message.report,
            );
            break;
        }
      });
    });
  }

  /** Sets who receives the build events. */
  listen(listener: BuildListener): void {
    this.#listener = listener;
  }

  #call<T>(command: Command): Promise<T> {
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.#worker.postMessage({ ...command, id });
    });
  }

  start(
    generation: number,
    revision: number,
    config: BundlerConfig,
    files: FileMap | null,
  ): Promise<void> {
    return this.#call({ type: 'start', generation, revision, config, files });
  }

  apply(revision: number, changes: FileChange[]): Promise<void> {
    return this.#call({ type: 'apply', revision, changes });
  }

  read(path: string): Promise<Uint8Array | null> {
    return this.#call({ type: 'read', path });
  }

  list(): Promise<string[]> {
    return this.#call({ type: 'list' });
  }

  close(): Promise<void> {
    return this.#call({ type: 'close' });
  }
}
