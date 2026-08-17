export const counterUpdatedEventName = 'CounterUpdated';
export const counterTimingFlagPrefix = 'vanilla_counter_update_';
export const destroyLifetimeEventName = '__DestroyLifetime';
export const incrementCounterEventName = 'IncrementCounter';
export const performanceUpdatedEventName = 'PerformanceUpdated';

export type PipelineOptions = Record<string, unknown> & {
  dsl: string;
  needTimestamps: boolean;
  pipelineID: string;
  pipelineOrigin: string;
  stage: string;
  timingFlag: string;
};

export interface CounterPatch {
  count: number;
  pipelineOptions: PipelineOptions;
}

export interface PerformancePatch {
  kind: 'initialRender' | 'update';
  summary: string;
}
