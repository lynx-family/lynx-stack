export interface DecodeWorkerMessage {
  type: string;
  url: string;
}

export interface LoadTemplateMessage extends DecodeWorkerMessage {
  type: 'load';
  fetchUrl?: string;
}

export interface SectionMessage extends DecodeWorkerMessage {
  type: 'section';
  label: number;
  data: any;
  config?: Record<string, string>;
}

export interface ErrorMessage extends DecodeWorkerMessage {
  type: 'error';
  error: string;
}

export interface DoneMessage extends DecodeWorkerMessage {
  type: 'done';
}

export type WorkerMessage = LoadTemplateMessage;
export type MainMessage = SectionMessage | ErrorMessage | DoneMessage;
