import type { AddEventPAPI } from './MainThreadGlobalThis.js';

export type SSREventReplayInfo = [
  number,
  Parameters<AddEventPAPI>[1],
  Parameters<AddEventPAPI>[2],
  Parameters<AddEventPAPI>[3],
];

export type SSRDumpInfo = {
  ssrEncodeData: string | null | undefined;
  events: SSREventReplayInfo[];
};

export type SSRDehydrateHooks = {
  __AddEvent: AddEventPAPI;
};
