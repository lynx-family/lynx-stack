import type { PageConfig } from '../../types/PageConfig.js';

export interface DecodeWorkerMessage {
  type: string;
  url: string;
}

export interface InitMessage extends DecodeWorkerMessage {
  type: 'init';
  wasmModule: WebAssembly.Module;
}

export interface LoadTemplateMessage extends DecodeWorkerMessage {
  type: 'load';
  fetchUrl: string;
  transformVW: boolean;
  transformVH: boolean;
  transformREM: boolean;
  overrideConfig?: Record<string, string>;
}

export interface SectionMessage extends DecodeWorkerMessage {
  type: 'section';
  label: number;
  data: any;
  config?: PageConfig;
}

export interface ErrorMessage extends DecodeWorkerMessage {
  type: 'error';
  error: string;
}

export interface DoneMessage extends DecodeWorkerMessage {
  type: 'done';
}

/**
 * A Lynx XML markup document, handed back unparsed.
 *
 * The worker fetches and sniffs every artifact, but a markup card is converted on
 * the main thread instead of here. Doing it in the worker would mean serialising
 * the decoded style data to cross `postMessage`, which is precisely the pair of
 * rkyv passes `StyleSheetResource.fromRawStyleInfo` exists to avoid. Sending the
 * source string costs one structured clone of text and keeps the fetch and sniff
 * logic in one place.
 */
export interface MarkupMessage extends DecodeWorkerMessage {
  type: 'markup';
  source: string;
  transformVW: boolean;
  transformVH: boolean;
  transformREM: boolean;
  overrideConfig?: Partial<PageConfig>;
}

export interface HeartbreakMessage {
  type: 'heartbreak';
}

export interface ReadyMessage {
  type: 'ready';
}

export type WorkerMessage = LoadTemplateMessage | HeartbreakMessage;
export type MainMessage =
  | SectionMessage
  | ErrorMessage
  | DoneMessage
  | MarkupMessage
  | HeartbreakMessage
  | ReadyMessage;
