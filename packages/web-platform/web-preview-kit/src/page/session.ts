// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  EventName,
  Events,
  FileMap,
  LoadReason,
  MethodName,
  Methods,
  PreviewData,
} from '../protocol.js';
import { CARDS_DIRECTORY } from '../shared/assets.js';
import type { BuildReport, BundlerConfig } from '../worker/messages.js';
import { Bundler } from './bundler.js';
import { CardView } from './cardView.js';

/** The implementation of every method. */
export type Handlers = {
  [M in MethodName]: (
    params: Methods[M]['params'],
  ) => Promise<Methods[M]['result']> | Methods[M]['result'];
};

export interface SessionOptions {
  /** Where the card is rendered. */
  container: HTMLElement;
  /** Where the bundler's assets are served; ends with `/`. */
  publicPath: string;
  /** The CacheStorage cache the bundler writes to. */
  cacheName: string;
  /** Sends an event to the embedder. */
  emit<E extends EventName>(event: E, data: Events[E]): void;
}

const textDecoder = new TextDecoder();

/**
 * The state of the preview: the open project, its revisions and builds, and
 * the previewed card. It implements the protocol's methods and turns builds
 * into events, card loads and hot updates.
 */
export class Session {
  readonly #options: SessionOptions;
  readonly #bundler = new Bundler(this);
  readonly #view: CardView;

  /** Tags the bundler of the current project or configuration. */
  #generation = 0;
  #revision = 0;
  #entries: Record<string, string> = {};
  #card = '';
  #data: PreviewData = {};

  #buildCount = 0;
  #latest: BuildReport | undefined;
  #latestSuccess: BuildReport | undefined;
  /** A card is loaded from a build of the current configuration. */
  #loaded = false;
  /** A build failed after the latest successful one. */
  #failed = false;
  #loadCount = 0;

  constructor(options: SessionOptions) {
    this.#options = options;
    this.#view = new CardView(options.container, () => {
      // The running card could not apply a hot update. After
      // `project.configure` it can still be the card of the previous
      // configuration, before anything was built.
      if (this.#latestSuccess) {
        this.#load('hmr-fallback');
      }
    });
  }

  readonly handlers: Handlers = {
    'project.open': async ({ files, config, card, data }) => {
      this.#reset();
      this.#entries = config.entries;
      this.#card = card ?? Object.keys(config.entries)[0]!;
      this.#data = { ...data };
      this.#view.clear();
      await caches.delete(this.#options.cacheName);
      this.#revision = 1;
      await this.#start(files);
      return { revision: this.#revision };
    },

    'project.configure': async ({ config }) => {
      this.#reset();
      this.#entries = config.entries;
      if (!(this.#card in config.entries)) {
        this.#card = Object.keys(config.entries)[0]!;
      }
      this.#revision += 1;
      await this.#start(null);
      return { revision: this.#revision };
    },

    'project.close': async () => {
      this.#reset();
      this.#view.clear();
      await this.#bundler.call({ type: 'close' });
      await caches.delete(this.#options.cacheName);
      return undefined;
    },

    'fs.apply': async ({ changes }) => {
      this.#revision += 1;
      await this.#bundler.call({
        type: 'apply',
        revision: this.#revision,
        changes,
      });
      return { revision: this.#revision };
    },

    'fs.read': async ({ path, encoding }) => {
      const bytes = await this.#bundler.call<Uint8Array | undefined>({
        type: 'read',
        path,
      });
      if (!bytes) {
        throw new Error(`There is no file ${path}.`);
      }
      return {
        content: encoding === 'binary' ? bytes : textDecoder.decode(bytes),
      };
    },

    'fs.list': async () => ({
      files: await this.#bundler.call<string[]>({ type: 'list' }),
    }),

    'build.getAsset': async ({ name }) => {
      // Assets of earlier builds stay in the cache.
      const response = this.#latest?.assets.some(asset => asset.name === name)
        && await caches.match(new URL(name, this.#options.publicPath).href);
      if (!response) {
        throw new Error(`The latest build has no asset ${name}.`);
      }
      return { content: new Uint8Array(await response.arrayBuffer()) };
    },

    'preview.select': ({ card }) => {
      this.#card = card;
      // Before the first successful build, that build loads the card.
      if (this.#latestSuccess) {
        this.#load('select');
      }
      return { card };
    },

    'preview.reload': () => {
      if (this.#latestSuccess) {
        this.#load('reload');
      }
      return undefined;
    },

    'preview.setData': (data) => {
      this.#data = { ...this.#data, ...data };
      this.#view.setData(data);
      return undefined;
    },
  };

  buildStarted(generation: number, revision: number): void {
    if (generation !== this.#generation) {
      return;
    }
    this.#buildCount += 1;
    this.#options.emit('build.start', { buildId: this.#buildCount, revision });
  }

  buildDone(generation: number, revision: number, report: BuildReport): void {
    // Events of an earlier bundler can arrive after the page started the
    // next one.
    if (generation !== this.#generation) {
      return;
    }
    this.#latest = report;
    const success = report.errors.length === 0;
    this.#options.emit('build.done', {
      buildId: this.#buildCount,
      revision,
      success,
      ...report,
    });
    if (!success) {
      this.#failed = true;
      return;
    }
    const failed = this.#failed;
    this.#failed = false;
    this.#latestSuccess = report;
    if (!this.#loaded) {
      this.#load('open');
    } else if (failed) {
      // Web HMR bug: when the update chain of a card passes through a failed
      // compilation, the background thread applies it but the main thread
      // keeps the snapshots of the last good build, so the card shows stale
      // content until the next update (reproduces with `rsbuild dev` and the
      // web preview of examples/react). Loading the card again loses its
      // state once but shows the right content. Remove this branch when the
      // bug is fixed.
      this.#load('hmr-fallback');
    } else {
      this.#view.sendDevServerMessage({ type: 'hash', data: report.hash });
      this.#view.sendDevServerMessage({ type: 'ok' });
      this.#options.emit('preview.hmr', {
        card: this.#card,
        hash: report.hash,
      });
    }
  }

  async #start(files: FileMap | null): Promise<void> {
    const config: BundlerConfig = {
      entries: this.#entries,
      publicPath: this.#options.publicPath,
      cacheName: this.#options.cacheName,
    };
    await this.#bundler.call({
      type: 'start',
      generation: this.#generation,
      revision: this.#revision,
      config,
      files,
    });
  }

  /** Loads the previewed card from the latest successful build. */
  #load(reason: LoadReason): void {
    const build = this.#latestSuccess!;
    const { bundle } = build.cards.find(card => card.name === this.#card)!;
    this.#loadCount += 1;
    // web-core caches a decoded template by its URL, so every load uses a
    // new one. The Service Worker ignores the query.
    const url = new URL(
      bundle,
      new URL(CARDS_DIRECTORY, this.#options.publicPath),
    );
    url.searchParams.set('load', String(this.#loadCount));
    this.#loaded = true;
    this.#view.load(url.href, this.#data);
    this.#options.emit('preview.load', {
      card: this.#card,
      hash: build.hash,
      reason,
    });
  }

  /** Starts a new generation, whose builds are the only ones that count. */
  #reset(): void {
    this.#generation += 1;
    this.#latest = undefined;
    this.#latestSuccess = undefined;
    this.#loaded = false;
    this.#failed = false;
  }
}
