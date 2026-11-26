// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BuiltinPackages,
  EventName,
  Events,
  FileChange,
  FileContent,
  FileMap,
  HelloInfo,
  LoadReason,
  PreviewData,
  ProjectConfig,
} from '../protocol.js';
import { PROTOCOL_VERSION } from '../protocol.js';
import type { BuildReport, BundlerConfig } from '../worker/messages.js';
import type { AssetStore } from './assetStore.js';
import { ProtocolException } from './errors.js';
import type { Handlers } from './router.js';

/** The page's handle on the bundler worker. */
export interface BundlerClient {
  start(
    generation: number,
    revision: number,
    config: BundlerConfig,
    files: FileMap | null,
  ): Promise<void>;
  apply(revision: number, changes: FileChange[]): Promise<void>;
  read(path: string): Promise<Uint8Array | null>;
  list(): Promise<string[]>;
  close(): Promise<void>;
}

/** A message of the dev-server protocol that the HMR client of a card reads. */
export type DevServerMessage =
  | { type: 'hash'; data: string }
  | { type: 'ok' }
  | { type: 'errors'; data: { text: string[] } };

/** What renders the previewed card. */
export interface CardHost {
  /** Loads a card from scratch, replacing whatever is shown. */
  load(url: string, data: PreviewData): void;
  /** Removes the card. */
  clear(): void;
  /** Updates the data of the running card; omitted fields are unchanged. */
  setData(data: PreviewData): void;
  /** Sends a dev-server message to the running card. */
  sendDevServerMessage(message: DevServerMessage): void;
}

/** Whether the kit can build where it runs. */
export interface Support {
  supported: boolean;
  reason?: string;
}

export interface SessionOptions {
  support: Support;
  builtinPackages: BuiltinPackages;
  /** Where the bundler's assets are served; ends with `/`. */
  publicPath: string;
  /** The CacheStorage cache the bundler writes to. */
  cacheName: string;
  bundler: BundlerClient;
  assets: AssetStore;
  host: CardHost;
  /** Sends an event to the host application. */
  emit<E extends EventName>(event: E, data: Events[E]): void;
}

interface LoadedCard {
  card: string;
  hash: string;
}

/** A successful build, with where its card bundles were copied to. */
interface SuccessfulBuild {
  report: BuildReport;
  /** The URL prefix of the copies of its card bundles. */
  cards: string;
}

const textDecoder = new TextDecoder();

/**
 * The state of one preview: the open project, its revisions and builds, and
 * the previewed card. It implements the protocol's methods and turns build
 * reports into events and card loads.
 */
export class Session {
  readonly #options: SessionOptions;

  #open = false;
  /** Tags the bundler of the current project or configuration. */
  #generation = 0;
  #revision = 0;
  #config: Required<ProjectConfig> = {
    entries: {},
    mode: 'development',
    hmr: true,
  };
  #card: string | undefined;
  #data: PreviewData = {};

  #buildCount = 0;
  #runningBuild: number | undefined;
  #latest: BuildReport | undefined;
  #latestSuccess: SuccessfulBuild | undefined;
  /** Build reports are handled one after another. */
  #builds: Promise<void> = Promise.resolve();
  #loaded: LoadedCard | undefined;
  /**
   * A build failed after the build the running card is at, so its next hot
   * update would pass through the failed compilation.
   */
  #failedSinceLoad = false;
  /** A build failed after the latest successful one. */
  #failedSinceSuccess = false;
  #loadCount = 0;

  constructor(options: SessionOptions) {
    this.#options = options;
  }

  /** The data of the `hello` event. */
  get hello(): HelloInfo {
    const { support, builtinPackages } = this.#options;
    return {
      version: PROTOCOL_VERSION,
      supported: support.supported,
      ...(support.reason === undefined ? {} : { reason: support.reason }),
      builtinPackages,
    };
  }

  /** The implementation of the protocol's methods. */
  readonly handlers: Handlers = {
    'project.open': async ({ files, config, card, data }) => {
      this.#requireSupport();
      const normalized = normalizeConfig(config);
      const selected = card ?? Object.keys(normalized.entries)[0]!;
      if (!(selected in normalized.entries)) {
        throw unknownCard(selected);
      }
      this.#generation += 1;
      this.#open = true;
      this.#revision = 1;
      this.#config = normalized;
      this.#card = selected;
      this.#data = { ...data };
      this.#resetBuilds();
      this.#options.host.clear();
      await this.#options.assets.clear();
      await this.#options.bundler.start(
        this.#generation,
        this.#revision,
        this.#bundlerConfig(),
        files,
      );
      return { revision: this.#revision };
    },

    'project.configure': async ({ config }) => {
      this.#requireOpen();
      const normalized = normalizeConfig(config);
      const revision = this.#revision + 1;
      this.#generation += 1;
      this.#config = normalized;
      if (this.#card === undefined || !(this.#card in normalized.entries)) {
        this.#card = Object.keys(normalized.entries)[0]!;
      }
      this.#resetBuilds();
      await this.#options.bundler.start(
        this.#generation,
        revision,
        this.#bundlerConfig(),
        null,
      );
      this.#revision = revision;
      return { revision };
    },

    'project.close': async () => {
      if (!this.#open) {
        return undefined;
      }
      this.#open = false;
      this.#generation += 1;
      this.#card = undefined;
      this.#resetBuilds();
      this.#options.host.clear();
      await this.#options.bundler.close();
      await this.#options.assets.clear();
      return undefined;
    },

    'fs.apply': async ({ changes }) => {
      this.#requireOpen();
      const revision = this.#revision + 1;
      await this.#options.bundler.apply(revision, changes);
      this.#revision = revision;
      return { revision };
    },

    'fs.read': async ({ path, encoding }) => {
      this.#requireOpen();
      const bytes = await this.#options.bundler.read(path);
      if (!bytes) {
        throw new ProtocolException('NOT_FOUND', `There is no file ${path}.`);
      }
      const content: FileContent = encoding === 'binary'
        ? bytes
        : textDecoder.decode(bytes);
      return { content };
    },

    'fs.list': async () => {
      this.#requireOpen();
      return { files: await this.#options.bundler.list() };
    },

    'build.getAsset': async ({ name }) => {
      this.#requireOpen();
      const listed = this.#latest?.assets.some(asset => asset.name === name);
      const content = listed
        ? await this.#options.assets.read(name)
        : undefined;
      if (!content) {
        throw new ProtocolException(
          'NOT_FOUND',
          `The latest build has no asset ${name}.`,
        );
      }
      return { content };
    },

    'preview.select': ({ card }) => {
      this.#requireOpen();
      if (!(card in this.#config.entries)) {
        throw unknownCard(card);
      }
      this.#card = card;
      if (this.#latestSuccess) {
        this.#load('select');
      } else {
        // Nothing has been built yet; the first successful build loads it.
        this.#loaded = undefined;
        this.#options.host.clear();
      }
      return { card };
    },

    'preview.reload': () => {
      this.#requireOpen();
      if (this.#latestSuccess && this.#card !== undefined) {
        this.#load('reload');
      }
      return undefined;
    },

    'preview.setData': (data) => {
      this.#requireOpen();
      this.#data = { ...this.#data, ...data };
      this.#options.host.setData(data);
      return undefined;
    },
  };

  /** A build of `generation` started. */
  buildStarted(generation: number, revision: number): void {
    if (generation !== this.#generation || !this.#open) {
      return;
    }
    this.#buildCount += 1;
    this.#runningBuild = this.#buildCount;
    this.#options.emit('build.start', { buildId: this.#buildCount, revision });
  }

  /**
   * A build of `generation` finished and its assets are stored. Resolves once
   * the build is reported and the card loaded or updated.
   */
  buildDone(
    generation: number,
    revision: number,
    report: BuildReport,
  ): Promise<void> {
    this.#builds = this.#builds.then(() =>
      this.#handleBuildDone(generation, revision, report)
    ).catch((error: unknown) => {
      console.error('[web-preview-kit] cannot handle a build', error);
    });
    return this.#builds;
  }

  async #handleBuildDone(
    generation: number,
    revision: number,
    report: BuildReport,
  ): Promise<void> {
    if (generation !== this.#generation || !this.#open) {
      return;
    }
    let buildId = this.#runningBuild;
    if (buildId === undefined) {
      this.#buildCount += 1;
      buildId = this.#buildCount;
    }
    this.#runningBuild = undefined;
    this.#latest = report;
    const success = report.errors.length === 0;
    const { assets, host } = this.#options;
    assets.prune(report.assets.map(asset => asset.name)).catch(
      (error: unknown) => {
        console.error('[web-preview-kit] cannot prune old assets', error);
      },
    );
    this.#options.emit('build.done', {
      buildId,
      revision,
      success,
      hash: report.hash,
      durationMs: report.durationMs,
      errors: report.errors,
      warnings: report.warnings,
      cards: success ? report.cards : [],
      assets: report.assets,
    });

    if (!success) {
      this.#failedSinceSuccess = true;
      if (this.#loaded) {
        this.#failedSinceLoad = true;
      }
      // Tell the card what a dev server would; it keeps running as it is.
      if (this.#loaded && this.#hmr) {
        host.sendDevServerMessage({ type: 'hash', data: report.hash });
        host.sendDevServerMessage({
          type: 'errors',
          data: { text: report.errors.map(error => error.message) },
        });
      }
      return;
    }
    // A later failed build rewrites the card bundles, so cards load from
    // copies.
    const cards = await assets.snapshot(
      String(buildId),
      report.cards.map(card => card.bundle),
    );
    if (generation !== this.#generation || !this.#open) {
      return;
    }
    this.#latestSuccess = { report, cards };
    this.#failedSinceSuccess = false;
    if (this.#card === undefined) {
      return;
    }
    if (!this.#loaded) {
      this.#load('open');
    } else if (this.#hmr && this.#failedSinceLoad) {
      // Web HMR bug: when the update chain of a card passes through a failed
      // compilation, the background thread applies it but the main thread
      // keeps the snapshots of the last good build, so the card shows stale
      // text until the next update (reproduces with `rsbuild dev` and the web
      // preview of examples/react). Loading the card again loses its state
      // once but shows the right content. Remove this branch when the bug is
      // fixed.
      this.#load('hmr-fallback');
    } else if (this.#hmr) {
      host.sendDevServerMessage({ type: 'hash', data: report.hash });
      host.sendDevServerMessage({ type: 'ok' });
      this.#loaded.hash = report.hash;
      this.#options.emit('preview.hmr', {
        card: this.#loaded.card,
        hash: report.hash,
      });
    } else {
      this.#load('rebuild');
    }
  }

  /** The running card could not apply a hot update and asked for a reload. */
  reloadRequested(): void {
    if (this.#open && this.#loaded && this.#latestSuccess) {
      this.#load('hmr-fallback');
    }
  }

  /** The running card reported an error. */
  cardError(error: { message: string; stack?: string; fileName?: string }) {
    if (this.#loaded) {
      this.#options.emit('preview.error', {
        card: this.#loaded.card,
        ...error,
      });
    }
  }

  get #hmr(): boolean {
    return this.#config.mode === 'development' && this.#config.hmr;
  }

  #load(reason: LoadReason): void {
    const { report: build, cards } = this.#latestSuccess!;
    const card = this.#card!;
    const info = build.cards.find(item => item.name === card);
    if (!info) {
      this.#loaded = undefined;
      this.#options.host.clear();
      return;
    }
    this.#loadCount += 1;
    // web-core caches a decoded template by its URL, so every load uses a
    // new one. The Service Worker ignores the query.
    const url = new URL(info.bundle, cards);
    url.searchParams.set('load', String(this.#loadCount));
    this.#loaded = { card, hash: build.hash };
    // A card loaded from the last good build after a failed one catches up
    // through the failed compilation too.
    this.#failedSinceLoad = this.#failedSinceSuccess;
    this.#options.host.load(url.href, this.#data);
    this.#options.emit('preview.load', { card, hash: build.hash, reason });
  }

  #resetBuilds(): void {
    this.#failedSinceLoad = false;
    this.#failedSinceSuccess = false;
    this.#runningBuild = undefined;
    this.#latest = undefined;
    this.#latestSuccess = undefined;
    this.#loaded = undefined;
  }

  #bundlerConfig(): BundlerConfig {
    return {
      entries: this.#config.entries,
      mode: this.#config.mode,
      hmr: this.#hmr,
      publicPath: this.#options.publicPath,
      cacheName: this.#options.cacheName,
    };
  }

  #requireSupport(): void {
    const { support } = this.#options;
    if (!support.supported) {
      throw new ProtocolException(
        'UNSUPPORTED',
        support.reason ?? 'The kit cannot build here.',
      );
    }
  }

  #requireOpen(): void {
    this.#requireSupport();
    if (!this.#open) {
      throw new ProtocolException('NOT_OPEN', 'No project is open.');
    }
  }
}

function normalizeConfig(config: ProjectConfig): Required<ProjectConfig> {
  return {
    entries: { ...config.entries },
    mode: config.mode ?? 'development',
    hmr: config.hmr ?? true,
  };
}

function unknownCard(card: string): ProtocolException {
  return new ProtocolException(
    'UNKNOWN_CARD',
    `${JSON.stringify(card)} is not an entry of the project.`,
  );
}
