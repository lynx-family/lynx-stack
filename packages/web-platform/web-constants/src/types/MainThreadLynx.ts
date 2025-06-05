import type { Cloneable } from './Cloneable.js';
import type { LynxContextEventTarget } from './LynxContextEventTarget.js';
export interface MainThreadLynx {
  getJSContext: () => LynxContextEventTarget;
  requestAnimationFrame: (cb: () => void) => number;
  cancelAnimationFrame: (handler: number) => void;
  __globalProps: unknown;
  getCustomSectionSync: (key: string) => Cloneable;
  markPipelineTiming: (pipelineId: string, timingKey: string) => void;
}
