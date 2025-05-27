import type { LynxRuntimeInfo } from './LynxElementRuntimeInfo.js';

export type SSRHydrateData = {
  replayAddEvent: [number, string, string, string][];
  runtimeInfos: LynxRuntimeInfo[];
  ssrEncodeData: string;
};
