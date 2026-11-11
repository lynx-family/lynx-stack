// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  buildReactLynx,
  normalizeReactLynxSource,
  parseReactLynxSource,
} from '@lynx-js/genui-reactlynx';

import { getReactLynxAgentService } from '../../../service/reactlynx/reactlynx-agent.js';
import { createTextStreamRoute } from '../../common/text-stream-route.js';
import { publishReactLynxBuild } from '../artifacts.js';

export default createTextStreamRoute({
  scope: 'reactlynx:stream',
  path: '/reactlynx/stream',
  getService: getReactLynxAgentService,
  normalizeFinalText: normalizeReactLynxSource,
  async postprocess(
    text,
    {
      signal,
      emit,
      recordArtifactBuild,
      recordArtifactUpload,
    },
  ) {
    const source = parseReactLynxSource(text);
    emit('source', source);
    let buildStartedAt: number | undefined;
    let buildDurationMs: number | undefined;
    let assets: Awaited<ReturnType<typeof buildReactLynx>>;
    try {
      assets = await buildReactLynx(
        source,
        signal,
        status => {
          if (status === 'building') buildStartedAt = performance.now();
          emit('build', { status });
        },
      );
    } finally {
      if (buildStartedAt !== undefined) {
        buildDurationMs = performance.now() - buildStartedAt;
        recordArtifactBuild(buildDurationMs);
      }
    }
    if (buildDurationMs === undefined) {
      throw new Error('ReactLynx build did not enter the active build stage');
    }
    emit('build', { status: 'publishing' });
    const publishStartedAt = performance.now();
    let artifact: Awaited<ReturnType<typeof publishReactLynxBuild>>;
    try {
      artifact = await publishReactLynxBuild(assets, signal);
    } finally {
      recordArtifactUpload(performance.now() - publishStartedAt);
    }
    const roundedBuildDurationMs = Math.round(buildDurationMs);
    emit('build', {
      status: 'ready',
      buildDurationMs: roundedBuildDurationMs,
    });
    return {
      artifact,
      buildDurationMs: roundedBuildDurationMs,
    };
  },
});
