// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The message protocol between an embedding application and the preview kit.
 * `PROTOCOL.md` describes it in prose; this file is the source of truth for
 * the shapes. It has no runtime dependencies, so an embedder can import it.
 */

import type {
  AssetInfo,
  CardInfo,
  Diagnostic,
  FileChange,
  FileContent,
  FileMap,
} from '@lynx-js/web-bundle-kit';

export type {
  AssetInfo,
  CardInfo,
  Diagnostic,
  FileChange,
  FileContent,
  FileMap,
};

/** Marks a window message as belonging to this protocol. */
export const PROTOCOL_CHANNEL = 'lynx-web-preview';

/**
 * Kit to `window.parent`, posted once with target origin `*` when the kit
 * has loaded.
 */
export interface ReadyMessage {
  /** Always {@link PROTOCOL_CHANNEL}. */
  channel: typeof PROTOCOL_CHANNEL;
  /** Always `'ready'`. */
  type: 'ready';
}

/**
 * `window.parent` to kit: opens the session and transfers exactly one
 * `MessagePort`, which carries everything after the handshake.
 */
export interface ConnectMessage {
  /** Always {@link PROTOCOL_CHANNEL}. */
  channel: typeof PROTOCOL_CHANNEL;
  /** Always `'connect'`. */
  type: 'connect';
}

/** What the kit builds. */
export interface ProjectConfig {
  /** The cards of the project: card name to entry module, such as `src/index.tsx`. */
  entries: Record<string, string>;
}

/** Data handed to the previewed card. */
export interface PreviewData {
  /** The card's `initData`. */
  initData?: unknown;
  /** The card's `globalProps`. */
  globalProps?: unknown;
}

/** The requests an embedder can make, with their parameters and results. */
export interface Methods {
  /** Replaces the open project with `files` and starts building and previewing; the first revision is 1. */
  'project.open': {
    params: {
      /** The files of the project. */
      files: FileMap;
      /** What to build. */
      config: ProjectConfig;
      /** The card to preview; defaults to the first entry. */
      card?: string;
      /** The data of the card. */
      data?: PreviewData;
    };
    result: {
      /** The file system revision after the request. */
      revision: number;
    };
  };

  /** Replaces the configuration and rebuilds from scratch, keeping the files. */
  'project.configure': {
    params: {
      /** What to build. */
      config: ProjectConfig;
    };
    result: {
      /** The file system revision after the request. */
      revision: number;
    };
  };

  /** Stops the bundler and removes the preview. */
  'project.close': { params: undefined; result: undefined };

  /** Applies file changes in order, as one batch that causes one rebuild. */
  'fs.apply': {
    params: {
      /** The changes, applied in order. */
      changes: FileChange[];
    };
    result: {
      /** The file system revision after the request. */
      revision: number;
    };
  };

  /** Reads a project file. */
  'fs.read': {
    params: {
      /** The project-relative path. */
      path: string;
      /** `'utf8'` returns a string and `'binary'` a `Uint8Array`; defaults to `'utf8'`. */
      encoding?: 'utf8' | 'binary';
    };
    result: {
      /** The content of the file. */
      content: FileContent;
    };
  };

  /** Lists the project's files. */
  'fs.list': {
    params: undefined;
    result: {
      /** Sorted project-relative paths. */
      files: string[];
    };
  };

  /** Reads an asset of the latest build, such as a card's web bundle. */
  'build.getAsset': {
    params: {
      /** The asset name, as in {@link BuildSummary.assets}. */
      name: string;
    };
    result: {
      /** The bytes of the asset. */
      content: Uint8Array;
    };
  };

  /** Previews another card. */
  'preview.select': {
    params: {
      /** The card name, a key of {@link ProjectConfig.entries}. */
      card: string;
    };
    result: {
      /** The previewed card. */
      card: string;
    };
  };

  /** Loads the previewed card again from the latest successful build. */
  'preview.reload': { params: undefined; result: undefined };

  /** Updates the data of the previewed card and of the cards loaded later; omitted fields keep their value. */
  'preview.setData': { params: PreviewData; result: undefined };
}

/** The name of a request. */
export type MethodName = keyof Methods;

/** A request, embedder to kit. */
export interface RequestMessage<M extends MethodName = MethodName> {
  /** A number chosen by the embedder and echoed in the response. */
  id: number;
  /** The method to call. */
  method: M;
  /** The parameters of the method. */
  params: Methods[M]['params'];
}

/** A response, kit to embedder: exactly one per request, in the order of the requests. */
export type ResponseMessage<M extends MethodName = MethodName> =
  | {
    /** The `id` of the request. */
    id: number;
    /** The result of the method. */
    result: Methods[M]['result'];
  }
  | {
    /** The `id` of the request. */
    id: number;
    /** Why the request failed. */
    error: {
      /** The message of what was thrown while the request was handled. */
      message: string;
    };
  };

/** The outcome of one build. */
export interface BuildSummary {
  /** Counts the builds, starting at 1. */
  buildId: number;
  /** The file system revision the build saw, which includes every earlier change. */
  revision: number;
  /** Whether the build has no errors. */
  success: boolean;
  /** The compilation hash. */
  hash: string;
  /** How long the build took. */
  durationMs: number;
  /** The errors of the build. */
  errors: Diagnostic[];
  /** The warnings of the build. */
  warnings: Diagnostic[];
  /** The cards that were built; empty when the build failed. */
  cards: CardInfo[];
  /** Every asset of the build, readable with `build.getAsset`. */
  assets: AssetInfo[];
}

/** Why a card was loaded from scratch. */
export type LoadReason =
  /** The first successful build after `project.open` or `project.configure`. */
  | 'open'
  /** `preview.select`. */
  | 'select'
  /** `preview.reload`. */
  | 'reload'
  /** The card could not apply a hot update, or this is the first successful build after a failed one. */
  | 'hmr-fallback';

/** The events the kit sends, with their data. */
export interface Events {
  /** A build started. */
  'build.start': {
    /** The id of the build. */
    buildId: number;
    /** The file system revision the build sees. */
    revision: number;
  };

  /** A build finished, successfully or not. */
  'build.done': BuildSummary;

  /** A card started loading from scratch. */
  'preview.load': {
    /** The card. */
    card: string;
    /** The hash of the build it was loaded from. */
    hash: string;
    /** Why it was loaded. */
    reason: LoadReason;
  };

  /** A hot update was sent to the running card. */
  'preview.hmr': {
    /** The card. */
    card: string;
    /** The hash of the build it is updated to. */
    hash: string;
  };
}

/** The name of an event. */
export type EventName = keyof Events;

/** An event, kit to embedder. */
export interface EventMessage<E extends EventName = EventName> {
  /** The name of the event. */
  event: E;
  /** The data of the event. */
  data: Events[E];
}

/** Everything the kit sends over the port. */
export type KitMessage = ResponseMessage | EventMessage;
