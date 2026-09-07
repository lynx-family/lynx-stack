// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  createHtmlFragmentScriptRunScope,
  createHtmlFragmentToMainThreadScriptTool,
  resolveHtmlFragmentScriptPlaceholders,
} from '../agent/html-fragment-to-main-thread-script-tool.js';

interface FragmentToolOutput {
  bindings: Record<string, string>;
  placeholder: string;
}

async function executeFragmentTool(
  xmlFragment: string,
  scope = createHtmlFragmentScriptRunScope(),
): Promise<{ output: FragmentToolOutput; scope: typeof scope }> {
  const tool = createHtmlFragmentToMainThreadScriptTool();
  if (!tool.execute) throw new Error('fragment tool execute is missing');
  const output = await tool.execute(
    { xmlFragment },
    { requestContext: scope.requestContext } as never,
  );
  return { output: output as FragmentToolOutput, scope };
}

describe('HTML fragment to main-thread script tool', () => {
  test('returns an opaque placeholder and id-to-node bindings', async () => {
    const { output, scope } = await executeFragmentTool(
      '<view id="root"><text id="label">Hello</text></view>',
    );

    expect(output.placeholder).toMatch(
      /^\/\*__GENUI_HTML_FRAGMENT_[0-9a-f-]{36}__\*\/$/u,
    );
    expect(output.bindings).toEqual({ root: 'node0', label: 'node1' });
    expect(Object.hasOwn(output, 'javascript')).toBe(false);

    const artifact = `function renderPage() {
  const page = __CreatePage("0", 0);
  const pageId = __GetElementUniqueID(page);
  ${output.placeholder}
  __AddEventListener(node1, "tap", onTap, {});
}`;
    const resolved = resolveHtmlFragmentScriptPlaceholders(scope, artifact);
    expect(resolved).toContain('const node0 = __CreateView(pageId);');
    expect(resolved).toContain('__SetID(node1, "label");');
    expect(resolved).toContain(
      '__AddEventListener(node1, "tap", onTap, {});',
    );
    expect(resolved).not.toContain('__GENUI_HTML_FRAGMENT_');
  });

  test('isolates placeholders per run and rejects invalid placement', async () => {
    const first = await executeFragmentTool('<view id="first"/>');
    const second = await executeFragmentTool('<view id="second"/>');

    expect(first.output.placeholder).not.toBe(second.output.placeholder);
    expect(() =>
      resolveHtmlFragmentScriptPlaceholders(
        first.scope,
        second.output.placeholder,
      )
    ).toThrow('unknown fragment placeholder');
    expect(() =>
      resolveHtmlFragmentScriptPlaceholders(first.scope, 'no placeholder')
    ).toThrow('must appear exactly once');
    expect(() =>
      resolveHtmlFragmentScriptPlaceholders(
        first.scope,
        `${first.output.placeholder}\n${first.output.placeholder}`,
      )
    ).toThrow('must appear exactly once');
    expect(() =>
      resolveHtmlFragmentScriptPlaceholders(
        first.scope,
        `const marker = ${JSON.stringify(first.output.placeholder)};`,
      )
    ).toThrow('must appear on its own line');

    const tool = createHtmlFragmentToMainThreadScriptTool();
    if (!tool.execute) throw new Error('fragment tool execute is missing');
    await expect(tool.execute(
      { xmlFragment: '<view/>' },
      { requestContext: first.scope.requestContext } as never,
    )).rejects.toThrow('may only be called once per agent run');
  });

  test('exposes the converter as a Mastra tool', () => {
    expect(createHtmlFragmentToMainThreadScriptTool().id).toBe(
      'html_fragment_to_main_thread_script',
    );
  });
});
