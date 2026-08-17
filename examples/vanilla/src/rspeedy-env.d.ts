/// <reference types="@rspeedy/core/client" />

import type { ElementRef } from '@lynx-js/type-element-api';
import type { LynxSetTimeout } from '@lynx-js/types';

import type { PipelineOptions } from './events.js';

declare module '@lynx-js/types/background' {
  interface Performance {
    _bindPipelineIdWithTimingFlag?(
      pipelineID: string,
      timingFlag: string,
    ): void;
    _generatePipelineOptions?(): PipelineOptions;
    _onPipelineStart?(
      pipelineID: string,
      options?: PipelineOptions,
    ): void;
  }
}

declare global {
  const setTimeout: LynxSetTimeout;

  function __AddEventListener(
    node: ElementRef,
    name: string,
    handler: (...args: unknown[]) => unknown,
    eventOptions?: Record<string, unknown>,
  ): void;

  function __RemoveEventListener(
    node: ElementRef,
    name: string,
    handler: (...args: unknown[]) => unknown,
    eventOptions?: Record<string, unknown>,
  ): void;
}
