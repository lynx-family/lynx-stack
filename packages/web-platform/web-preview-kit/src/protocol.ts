// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The message protocol between a host application and the preview kit running
 * in an iframe, or as the top-level page. `PROTOCOL.md` describes it in prose;
 * this file is the source of truth for the shapes.
 *
 * This module has no runtime dependencies, so a host can import it directly.
 */

import type {
  AssetInfo,
  BuiltinPackages,
  CardInfo,
  Diagnostic,
  FileChange,
  FileContent,
  FileMap,
} from '@lynx-js/web-bundle-kit';

export type {
  AssetInfo,
  BuiltinPackages,
  CardInfo,
  Diagnostic,
  FileChange,
  FileContent,
  FileMap,
};

/** The protocol version this file describes. */
export const PROTOCOL_VERSION = 1;

/** Marks a window message as belonging to this protocol. */
export const PROTOCOL_CHANNEL = 'lynx-web-preview';

// ---------------------------------------------------------------------------
// Handshake: plain `window.postMessage`, three message types.
// ---------------------------------------------------------------------------

/**
 * Kit to parent, posted with target origin `*` when the kit has loaded, and
 * again in answer to every {@link ProbeMessage}. It carries nothing private.
 * A top-level kit posts it to its own window.
 */
export interface ReadyMessage {
  channel: typeof PROTOCOL_CHANNEL;
  type: 'ready';
  /** The protocol versions this kit can speak. */
  versions: number[];
}

/**
 * Parent to kit: asks for a {@link ReadyMessage}, for a host that started
 * listening after the kit announced itself.
 */
export interface ProbeMessage {
  channel: typeof PROTOCOL_CHANNEL;
  type: 'probe';
}

/**
 * Parent to kit: opens the session. It must transfer exactly one
 * `MessagePort`; everything after the handshake travels over that port.
 *
 * The kit only accepts it from `window.parent`. When the kit is the
 * top-level page, `window.parent` is the kit's own window, so only scripts
 * of the page itself can connect; other windows, such as an opener, cannot.
 * A later `connect` replaces the port of an earlier one and keeps the kit's
 * state.
 */
export interface ConnectMessage {
  channel: typeof PROTOCOL_CHANNEL;
  type: 'connect';
  /** One of {@link ReadyMessage.versions}. */
  version: number;
}

export type HandshakeMessage = ReadyMessage | ProbeMessage | ConnectMessage;

// ---------------------------------------------------------------------------
// Session: requests, responses and events over the MessagePort.
// ---------------------------------------------------------------------------

/** What the kit builds and how. */
export interface ProjectConfig {
  /**
   * The cards of the project: card name to entry module, the module being a
   * project-relative path such as `src/index.tsx`. At least one.
   */
  entries: Record<string, string>;

  /**
   * The build mode.
   *
   * @defaultValue `'development'`
   */
  mode?: 'development' | 'production';

  /**
   * Whether a successful rebuild is applied to the running card as a hot
   * update. Only in development mode. When it is off, or when a hot update
   * cannot be applied, the card is reloaded instead.
   *
   * @defaultValue `true`
   */
  hmr?: boolean;
}

/** Data handed to the previewed card. */
export interface PreviewData {
  /** The card's `initData`. */
  initData?: unknown;
  /** The card's `globalProps`. */
  globalProps?: unknown;
}

/**
 * The requests a host can make, with their parameters and results.
 *
 * Every request that changes files resolves once the change is in the kit's
 * file system, with the new file system revision. It does not wait for the
 * build: builds are reported through events.
 */
export interface Methods {
  /**
   * Opens a project, replacing the one that was open: clears the file
   * system, writes `files`, and starts building and previewing.
   * The first revision of a project is 1. A running build is cancelled: its
   * `build.done` never comes.
   */
  'project.open': {
    params: {
      files: FileMap;
      config: ProjectConfig;
      /** The card to preview. Defaults to the first entry. */
      card?: string;
      /** Data for the card. */
      data?: PreviewData;
    };
    result: { revision: number };
  };

  /**
   * Replaces the configuration and rebuilds from scratch, keeping the files.
   * This is how entries are added or removed. If the previewed card is no
   * longer an entry, the first entry is previewed instead. A running build
   * is cancelled: its `build.done` never comes.
   */
  'project.configure': {
    params: { config: ProjectConfig };
    result: { revision: number };
  };

  /**
   * Closes the project: stops the bundler and removes the preview. A running
   * build is cancelled: its `build.done` never comes.
   */
  'project.close': { params: undefined; result: undefined };

  /**
   * Applies file changes in order, as one batch that causes one rebuild.
   * If any path is invalid, nothing is applied.
   */
  'fs.apply': {
    params: { changes: FileChange[] };
    result: { revision: number };
  };

  /** Reads a project file. `encoding` defaults to `'utf8'`. */
  'fs.read': {
    params: { path: string; encoding?: 'utf8' | 'binary' };
    result: { content: FileContent };
  };

  /** Lists the project's files as sorted project-relative paths. */
  'fs.list': { params: undefined; result: { files: string[] } };

  /** Reads an asset of the latest build, for example a card's web bundle. */
  'build.getAsset': {
    params: { name: string };
    result: { content: Uint8Array };
  };

  /** Switches the preview to another card. */
  'preview.select': { params: { card: string }; result: { card: string } };

  /** Reloads the previewed card from the latest successful build. */
  'preview.reload': { params: undefined; result: undefined };

  /**
   * Updates the data of the previewed card. Omitted fields keep their value.
   * The data also applies to cards selected later.
   */
  'preview.setData': { params: PreviewData; result: undefined };
}

export type MethodName = keyof Methods;

/**
 * A request, host to kit. `id` is chosen by the host and echoed back. A
 * message without a numeric `id` cannot be answered and is ignored.
 */
export interface RequestMessage<M extends MethodName = MethodName> {
  id: number;
  method: M;
  params: Methods[M]['params'];
}

/** Why a request failed. */
export type ErrorCode =
  /**
   * The message has a numeric `id` but is not a request this protocol
   * understands.
   */
  | 'INVALID_REQUEST'
  /** The method does not exist. */
  | 'UNKNOWN_METHOD'
  /** The parameters have the wrong shape, or the config has no entries. */
  | 'INVALID_PARAMS'
  /** A path breaks the path rules. */
  | 'INVALID_PATH'
  /** The method needs an open project. */
  | 'NOT_OPEN'
  /** The file or asset does not exist. */
  | 'NOT_FOUND'
  /** The card is not an entry of the project. */
  | 'UNKNOWN_CARD'
  /** The kit cannot build in this environment; see {@link HelloInfo}. */
  | 'UNSUPPORTED'
  /** Anything else. */
  | 'INTERNAL';

export interface ProtocolError {
  code: ErrorCode;
  message: string;
}

/** A response, kit to host: exactly one per request. */
export type ResponseMessage<M extends MethodName = MethodName> =
  | { id: number; result: Methods[M]['result'] }
  | { id: number; error: ProtocolError };

/** The first event of a session. */
export interface HelloInfo {
  /** The protocol version of the session. */
  version: number;
  /**
   * Whether the kit can build here. It cannot when the iframe is not
   * cross-origin isolated, cannot register a Service Worker, or the kit was
   * deployed without its bundler (`@lynx-js/web-bundle-kit`).
   */
  supported: boolean;
  /** Why not, when `supported` is false. */
  reason?: string;
  /** The packages every project gets without supplying them. */
  builtinPackages: BuiltinPackages;
}

/** The outcome of one build. */
export interface BuildSummary {
  /** Counts the builds of this session, starting at 1. */
  buildId: number;
  /**
   * The file system revision this build saw: it includes every change with
   * a revision up to and including this one.
   */
  revision: number;
  /** Whether the build has no errors. */
  success: boolean;
  /** The compilation hash. */
  hash: string;
  durationMs: number;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  /** The cards that were built. Empty when the build failed. */
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
  /** A rebuild, with hot updates off. */
  | 'rebuild'
  /**
   * A hot update that the card could not apply, or the first successful
   * build after a failed one while hot updates are on: a hot update through
   * a failed build is not applied correctly on web, so the card is loaded
   * again instead.
   */
  | 'hmr-fallback';

/** The events the kit sends, with their data. */
export interface Events {
  /** Sent once, right after the session opens. */
  'hello': HelloInfo;

  /** A build started. */
  'build.start': { buildId: number; revision: number };

  /** A build finished, successfully or not. */
  'build.done': BuildSummary;

  /** A card started loading from scratch, from the build with `hash`. */
  'preview.load': { card: string; hash: string; reason: LoadReason };

  /** A hot update to the build with `hash` was sent to the running card. */
  'preview.hmr': { card: string; hash: string };

  /** The running card reported a runtime error. */
  'preview.error': {
    card: string;
    message: string;
    stack?: string;
    /** The script the error came from, when known. */
    fileName?: string;
  };
}

export type EventName = keyof Events;

/** An event, kit to host. */
export interface EventMessage<E extends EventName = EventName> {
  event: E;
  data: Events[E];
}

/** Everything the host sends over the port. */
export type HostMessage = RequestMessage;

/** Everything the kit sends over the port. */
export type KitMessage = ResponseMessage | EventMessage;
