// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, rs } from '@rstest/core';
import { options } from 'preact';

import {
  beginPipeline,
  globalPipelineOptions,
  initTimingAPI,
  PipelineOrigins,
  setPipeline,
} from '../../../src/core/performance';
import { RENDER_COMPONENT } from '../../../src/shared/render-constants';

describe('beginPipeline', () => {
  it('leaves the pipeline unset when the host generates no options', () => {
    const generate = lynx.performance._generatePipelineOptions;
    lynx.performance._generatePipelineOptions = rs.fn(() => undefined);

    try {
      beginPipeline(false, PipelineOrigins.updateTriggeredByBts);

      expect(globalPipelineOptions).toBeUndefined();
    } finally {
      lynx.performance._generatePipelineOptions = generate;
      setPipeline(undefined);
    }
  });
  it('keeps an already-started pipeline when an update render begins', () => {
    const beginPipelineSpy = rs.fn();
    rs.stubGlobal('__JS__', true);
    initTimingAPI({
      shouldStartUpdatePipeline: () => true,
      beginPipeline: beginPipelineSpy,
    });
    setPipeline({ pipelineID: 'existing' } as never);

    try {
      (options as Record<string, any>)[RENDER_COMPONENT]?.({}, {}, {});

      expect(beginPipelineSpy).not.toHaveBeenCalled();
      expect(globalPipelineOptions?.pipelineID).toBe('existing');
    } finally {
      setPipeline(undefined);
      rs.unstubAllGlobals();
    }
  });
});
