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

export interface ReadyMessage {
  type: 'ready';
}

export type WorkerMessage = LoadTemplateMessage;
export type MainMessage =
  | SectionMessage
  | ErrorMessage
  | DoneMessage
  | ReadyMessage;
