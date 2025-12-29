import type { WebFiberElementImpl } from './Element.js';
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

export interface SSRHydrateInfo extends SSRDumpInfo {
  /** WeakRef<Element> */
  lynxUniqueIdToElement: WeakRef<WebFiberElementImpl>[];
  /** for cssog */
  lynxUniqueIdToStyleRulesIndex: number[];
  // @ts-expect-error
  cardStyleElement: HTMLStyleElement | null;
}

export type SSRDehydrateHooks = {
  __AddEvent: AddEventPAPI;
};
