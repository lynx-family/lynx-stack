// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import type { LynxXmlAgent } from '../agent/lynx-xml-agent';
import LynxXmlAgentService from '../service/lynx-xml-agent';

const VALID_ARTIFACT = `<!DOCTYPE lynx>
<style>
  .page { display: flex; }
</style>
<script main-thread>
  globalThis.renderPage = function renderPage() {
    const page = __CreatePage('main', 0);
    const content = __CreateView(__GetElementUniqueID(page));
    __AppendElement(page, content);
  };
</script>`;

describe('LynxXmlAgentService', () => {
  test('regenerates a complete artifact after a truncated script', async () => {
    const outputs = [
      {
        text: VALID_ARTIFACT.slice(0, -'</script>'.length),
        finishReason: 'length',
      },
      { text: VALID_ARTIFACT, finishReason: 'stop' },
    ];
    const receivedMessages: unknown[] = [];
    const agent: LynxXmlAgent = {
      generate(messages) {
        receivedMessages.push(messages);
        return outputs.shift();
      },
    };
    const service = new LynxXmlAgentService(() => agent);

    const result = await service.generateValidated(
      [{ role: 'user', content: 'Build a compact profile page' }],
      { maxRepairAttempts: 1 },
    );

    expect(result).toMatchObject({
      ok: true,
      text: VALID_ARTIFACT,
      attempts: 2,
      finishReason: 'stop',
    });
    expect(receivedMessages).toHaveLength(2);
    expect(JSON.stringify(receivedMessages[1])).toContain(
      'missing closing </script> tag',
    );
    expect(JSON.stringify(receivedMessages[1])).toContain(
      'Regenerate the entire artifact',
    );
    expect(JSON.stringify(receivedMessages[1])).toContain(
      'finish reason was \\"length\\"',
    );
  });

  test('returns the last validation error after repair attempts are exhausted', async () => {
    const agent: LynxXmlAgent = {
      generate() {
        return {
          text: VALID_ARTIFACT.slice(0, -'</script>'.length),
          finishReason: 'length',
        };
      },
    };
    const service = new LynxXmlAgentService(() => agent);

    const result = await service.generateValidated(
      [{ role: 'user', content: 'Build a compact profile page' }],
      { maxRepairAttempts: 1 },
    );

    expect(result).toMatchObject({
      ok: false,
      errors: ['missing closing </script> tag'],
      attempts: 2,
      finishReason: 'length',
    });
  });
});
