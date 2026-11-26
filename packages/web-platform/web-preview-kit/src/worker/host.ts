// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BuildEvent,
  FileMap,
  OutputAsset,
  WebBundler,
  WebBundlerOptions,
} from '@lynx-js/web-bundle-kit';

import type { BundlerConfig, WorkerCommand, WorkerEvent } from './messages.js';

/** What {@link BundlerHost} needs from its environment. */
export interface BundlerHostOptions {
  createWebBundler(options: WebBundlerOptions): Promise<WebBundler>;
  /** Stores the emitted assets of a build where the Service Worker serves them. */
  writeAssets(
    cacheName: string,
    publicPath: string,
    assets: OutputAsset[],
  ): Promise<void>;
  post(message: WorkerEvent): void;
}

interface Current {
  bundler: WebBundler;
  generation: number;
  config: BundlerConfig;
}

/**
 * The logic of the bundler worker: one `WebBundler` at a time, commands
 * handled one after another, builds reported in order and only after their
 * assets are stored.
 *
 * Revisions: a batch of changes is written to the bundler's file system
 * synchronously inside `applyChanges`, so a compilation that starts after
 * the call began sees all of it. The revision of a batch is recorded before
 * the call, and a build is labelled with the latest revision recorded when
 * it starts. Batches that arrive while a compilation runs are merged into the
 * next one, which is labelled with the newest of them, so a build's revision
 * always covers every change it includes.
 */
export class BundlerHost {
  readonly #options: BundlerHostOptions;
  #current: Current | undefined;
  #latestRevision = 0;
  #queue: Promise<void> = Promise.resolve();

  constructor(options: BundlerHostOptions) {
    this.#options = options;
  }

  /** Handles a command; the reply is posted when it is done. */
  receive(command: WorkerCommand): Promise<void> {
    this.#queue = this.#queue.then(async () => {
      try {
        const result = await this.#handle(command);
        this.#options.post({ type: 'reply', id: command.id, result });
      } catch (error) {
        this.#options.post({
          type: 'reply',
          id: command.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
    return this.#queue;
  }

  async #handle(command: WorkerCommand): Promise<unknown> {
    switch (command.type) {
      case 'start': {
        const files = command.files
          ?? (this.#current ? await snapshot(this.#current.bundler) : {});
        await this.#close();
        this.#latestRevision = command.revision;
        const { entries, mode, hmr, publicPath } = command.config;
        const bundler = await this.#options.createWebBundler({
          entries,
          mode,
          hmr,
          publicPath,
          files,
        });
        const current: Current = {
          bundler,
          generation: command.generation,
          config: command.config,
        };
        this.#current = current;
        this.#watch(current);
        return undefined;
      }
      case 'apply': {
        const { bundler } = this.#require();
        this.#latestRevision = command.revision;
        await bundler.applyChanges(command.changes);
        return undefined;
      }
      case 'read':
        return (await this.#require().bundler.readFile(command.path)) ?? null;
      case 'list':
        return this.#require().bundler.listFiles();
      case 'close':
        await this.#close();
        return undefined;
    }
  }

  #require(): Current {
    if (!this.#current) {
      throw new Error('No project is open.');
    }
    return this.#current;
  }

  async #close(): Promise<void> {
    const previous = this.#current;
    this.#current = undefined;
    await previous?.bundler.close();
  }

  #watch(target: Current): void {
    const { bundler, generation, config } = target;
    const { post } = this.#options;
    const isCurrent = () => this.#current?.generation === generation;
    let buildRevision = this.#latestRevision;
    let reporting = Promise.resolve();
    const listener = (event: BuildEvent): void => {
      if (event.type === 'start') {
        buildRevision = this.#latestRevision;
        const revision = buildRevision;
        reporting = reporting.then(() => {
          if (isCurrent()) {
            post({ type: 'build-start', generation, revision });
          }
        });
        return;
      }
      const revision = buildRevision;
      const { emitted, ...report } = event.result;
      reporting = reporting.then(async () => {
        if (!isCurrent()) {
          return;
        }
        await this.#options.writeAssets(
          config.cacheName,
          config.publicPath,
          emitted,
        );
        if (isCurrent()) {
          post({ type: 'build-done', generation, revision, report });
        }
      }).catch((error: unknown) => {
        console.error('[web-preview-kit] cannot store a build', error);
      });
    };
    // `watch` resolves after the first build; the queue does not wait.
    bundler.watch(listener).catch((error: unknown) => {
      console.error('[web-preview-kit] the bundler stopped watching', error);
    });
  }
}

async function snapshot(bundler: WebBundler): Promise<FileMap> {
  const files: FileMap = {};
  for (const path of await bundler.listFiles()) {
    const content = await bundler.readFile(path);
    if (content) {
      files[path] = content;
    }
  }
  return files;
}
