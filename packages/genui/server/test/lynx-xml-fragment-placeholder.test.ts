// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Readable } from 'node:stream';

import { beforeEach, describe, expect, rstest, test } from '@rstest/core';

import {
  createHtmlFragmentToMainThreadScriptTool,
} from '../agent/lynx-xml/html-fragment-to-main-thread-script-tool.js';
import type { HtmlFragmentScriptRunScope } from '../agent/lynx-xml/html-fragment-to-main-thread-script-tool.js';
import { createLynxXmlAgent } from '../agent/lynx-xml/lynx-xml-agent.js';
import LynxXmlAgentService from '../service/lynx-xml/lynx-xml-agent.js';

rstest.mock('../agent/lynx-xml/lynx-xml-agent.js', { mock: true });

interface FragmentToolOutput {
  bindings: Record<string, string>;
  placeholder: string;
}

function modelArtifact(placeholder: string, binding: string): string {
  return `<!doctype lynx>
<lynx engine-version="4.2">
<script thread="main">
function renderPage() {
  const page = __CreatePage("0", 0);
  const pageId = __GetElementUniqueID(page);
  ${placeholder}
  __AddEventListener(${binding}, "tap", onTap, {});
}
</script>
</lynx>`;
}

async function collect(source: AsyncIterable<string>): Promise<string> {
  let value = '';
  for await (const chunk of source) value += chunk;
  return value;
}

beforeEach(() => {
  rstest.mocked(createLynxXmlAgent).mockReset();
});

describe('Lynx XML fragment placeholder delivery', () => {
  test('keeps scripts request-scoped and expands only the final text', async () => {
    const placeholders: string[] = [];
    const fragments: string[] = [];
    const tool = createHtmlFragmentToMainThreadScriptTool();
    const execute = tool.execute;
    if (!execute) throw new Error('fragment tool execute is missing');

    const agent = {
      generate: () => Promise.resolve({ text: '' }),
      stream: async (
        _messages: unknown,
        options: {
          requestContext: HtmlFragmentScriptRunScope['requestContext'];
        },
      ) => {
        const xmlFragment =
          `<view id="button"><text>Tap ${fragments.length}</text></view>`;
        fragments.push(xmlFragment);
        const output = await execute(
          { xmlFragment },
          { requestContext: options.requestContext } as never,
        ) as FragmentToolOutput;
        const buttonBinding = output.bindings.button;
        if (!buttonBinding) throw new Error('button binding is missing');
        placeholders.push(output.placeholder);
        const text = modelArtifact(output.placeholder, buttonBinding);
        return {
          textStream: Readable.from([text]) as AsyncIterable<string>,
          text: undefined,
          totalUsage: { inputTokens: 3, outputTokens: 5 },
          finishReason: 'stop',
        };
      },
    };
    rstest.mocked(createLynxXmlAgent).mockReturnValue({
      agent,
      model: 'test-model',
    } as never);

    const service = new LynxXmlAgentService();
    const first = await service.streamAsAsyncIterable([]);
    const firstStreamedText = await collect(first.textStream);
    const firstFinal = await first.finalize();
    const second = await service.streamAsAsyncIterable([]);
    const secondStreamedText = await collect(second.textStream);
    const secondFinal = await second.finalize();

    expect(firstFinal.metadata).toEqual({
      xmlFragment: fragments[0],
      modelOutput: firstStreamedText,
    });
    expect(secondFinal.metadata).toEqual({
      xmlFragment: fragments[1],
      modelOutput: secondStreamedText,
    });
    expect(createLynxXmlAgent).toHaveBeenCalledTimes(1);
    expect(placeholders).toHaveLength(2);
    expect(placeholders[0]).not.toBe(placeholders[1]);
    expect(firstStreamedText).toContain(placeholders[0]);
    expect(secondStreamedText).toContain(placeholders[1]);
    expect(firstFinal.text).toContain('node0 = __CreateView(pageId);');
    expect(firstFinal.text).toContain(
      '__AddEventListener(node0, "tap", onTap, {});',
    );
    expect(secondFinal.text).toContain('node0 = __CreateView(pageId);');
    expect(firstFinal.text).not.toContain('__GENUI_HTML_FRAGMENT_');
    expect(secondFinal.text).not.toContain('__GENUI_HTML_FRAGMENT_');
  });
  test('returns original model output with and without fragment conversion', async () => {
    const xmlFragment = '<view id="button"><text>Original</text></view>';
    const execute = createHtmlFragmentToMainThreadScriptTool().execute;
    if (!execute) throw new Error('fragment tool execute is missing');
    let calls = 0;
    let modelOutput = '';
    rstest.mocked(createLynxXmlAgent).mockReturnValue({
      agent: {
        generate: async (
          _messages: unknown,
          options: HtmlFragmentScriptRunScope,
        ) => {
          if (calls++ > 0) {
            return { text: 'no conversion', finishReason: 'stop' };
          }
          const output = await execute({ xmlFragment }, {
            requestContext: options.requestContext,
          } as never) as FragmentToolOutput;
          modelOutput = `\n${
            modelArtifact(output.placeholder, output.bindings.button!)
          }\n`;
          return {
            text: modelOutput,
            finishReason: 'stop',
          };
        },
      },
      model: 'test-model',
    } as never);
    const service = new LynxXmlAgentService();
    const first = await service.generateRaw([]);
    expect(first.metadata).toEqual({ xmlFragment, modelOutput });
    expect(first.text).toContain('node0 = __CreateView(pageId);');
    expect(first.text).not.toContain('__GENUI_HTML_FRAGMENT_');
    const withoutConversion = await service.generateRaw([]);
    expect(withoutConversion.metadata).toEqual({
      modelOutput: 'no conversion',
    });
    expect(createLynxXmlAgent).toHaveBeenCalledTimes(1);
  });
});
