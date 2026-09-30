// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  buildReactWeb,
  normalizeReactWebSource,
  parseReactWebSource,
} from '@lynx-js/genui-reactweb';

import { getReactWebAgentService } from '../../../service/reactweb/reactweb-agent.js';
import { createTextStreamRoute } from '../../common/text-stream-route.js';
import { publishReactWebBuild } from '../artifacts.js';

export default createTextStreamRoute({
  scope: 'reactweb:stream',
  path: '/reactweb/stream',
  getService: getReactWebAgentService,
  normalizeFinalText: normalizeReactWebSource,
  async postprocess(
    text,
    { signal, emit, recordArtifactBuild, recordArtifactUpload },
  ) {
    const source = parseReactWebSource(text);
    emit('source', source);
    let buildStartedAt: number | undefined;
    let buildDurationMs: number | undefined;
    let html: string;
    try {
      html = await buildReactWeb(source, signal, status => {
        if (status === 'building') buildStartedAt = performance.now();
        emit('build', { status });
      });
    } finally {
      if (buildStartedAt !== undefined) {
        buildDurationMs = performance.now() - buildStartedAt;
        recordArtifactBuild(buildDurationMs);
      }
    }
    if (buildDurationMs === undefined) {
      throw new Error('ReactWeb build did not enter the active build stage');
    }
    emit('build', { status: 'publishing' });
    const publishStartedAt = performance.now();
    let artifact: Awaited<ReturnType<typeof publishReactWebBuild>>;
    try {
      artifact = await publishReactWebBuild(html, signal);
    } finally {
      recordArtifactUpload(performance.now() - publishStartedAt);
    }
    const roundedBuildDurationMs = Math.round(buildDurationMs);
    emit('build', { status: 'ready', buildDurationMs: roundedBuildDurationMs });
    return { artifact, buildDurationMs: roundedBuildDurationMs };
  },
});
