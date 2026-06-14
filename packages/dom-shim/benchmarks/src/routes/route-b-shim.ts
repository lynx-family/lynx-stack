// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import vm from 'node:vm';

import { callLLM, extractCodeBlock } from '../llm/anthropic-client.ts';
import { createMockShim } from '../mocks/mock-shim.ts';
import type { Route, RouteContext, RouteRoundResult } from '../types.ts';

const SYSTEM_PROMPT =
  `You are generating Lynx UI code through a Web-like DOM Shim layer.

Output a single HTML+JS code block (triple-backtick fenced \`\`\`html ... \`\`\`).
The block must contain a <script> tag whose body builds the UI under
\`document.body\`.

You may use:
  - document.createElement('view' | 'text' | 'image' | 'scroll-view' | 'input' | 'button')
  - element.appendChild(child)
  - element.setAttribute(name, value)
  - element.classList.add / remove / toggle / contains
  - element.style.X = value
  - element.addEventListener('click' | 'input' | ..., handler)
  - element.innerHTML = '<view>...</view>'   (parser is htmlparser2-style)
  - element.textContent = '...'
  - document.getElementById(id), document.body
  - Standard JavaScript control flow, closures, primitive values

Lynx element tags available: view, text, image, scroll-view, list, input, button.
Use <text> for any visible text content. Use <view> as the generic container.

CONSTRAINTS:
  - DO NOT use canvas, video, audio, iframe, form, table, svg, link, meta tags.
  - DO NOT call __XXX private PAPI directly. Use document/element APIs only.
  - End your script with: __flush__();
  - You may write the script either as an HTML <script>...</script> inside
    the code block, OR as a bare JavaScript program (no <script> tag). Both
    are accepted.

If a previous attempt failed, you'll receive the previous code and its
error. Read the error, fix the issue, and emit only the corrected code
block. Do not explain.`;

function buildUserPrompt(ctx: RouteContext): string {
  const head = `Generate the UI for this prompt:\n\n${ctx.prompt.prompt}\n\n`
    + `Expected capabilities: ${ctx.prompt.expected_capabilities.join(', ')}`;
  if (ctx.previous) {
    return `${head}\n\n---\nPrevious attempt (failed):\n\`\`\`html\n${ctx.previous.generated_code}\n\`\`\`\n\nError log:\n${ctx.previous.error_log}\n\nProduce a corrected version.`;
  }
  return head;
}

function extractScriptBody(
  code: string,
): { script: string; parseError: string } {
  // If the LLM returned <script>...</script>, lift it. Otherwise treat the
  // entire body as JS. Either way, must be a valid JS program.
  const scriptMatch = /<script[^>]*>([\s\S]*?)<\/script>/i.exec(code);
  if (scriptMatch?.[1]) return { script: scriptMatch[1], parseError: '' };
  return { script: code, parseError: '' };
}

function parseJsForSyntax(source: string): { ok: boolean; error: string } {
  try {
    // new vm.Script() syntax-checks without executing.

    new vm.Script(source, { filename: 'route-b-snippet.js' });
    return { ok: true, error: '' };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function previewPathFor(ctx: RouteContext): string {
  return resolvePath(
    ctx.out_dir,
    'previews',
    `${ctx.prompt.id}-B-r${ctx.round}.html`,
  );
}

const noop = (): void => {
  void 0;
};

async function runRouteB(ctx: RouteContext): Promise<RouteRoundResult> {
  if (ctx.dry_run) {
    return {
      generated_code:
        `<!-- dry-run stub for route B — ${ctx.prompt.id} round ${ctx.round} -->`,
      parse_ok: true,
      render_ok: true,
      error_log: '',
      screenshot_path: null,
      visual_score: null,
      visual_rationale: null,
    };
  }

  const llmResp = await callLLM({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(ctx),
    model: ctx.model_id,
  });
  const generatedCode = extractCodeBlock(llmResp.text);
  const { script } = extractScriptBody(generatedCode);

  const syntax = parseJsForSyntax(script);
  if (!syntax.ok) {
    return {
      generated_code: generatedCode,
      parse_ok: false,
      render_ok: false,
      error_log: syntax.error,
      screenshot_path: null,
      visual_score: null,
      visual_rationale: null,
      tokens_used: { input: llmResp.inputTokens, output: llmResp.outputTokens },
    };
  }

  const shim = createMockShim();
  const context: Record<string, unknown> = {
    ...shim.globals,
    console: { log: noop, info: noop, error: noop, warn: noop },
    setTimeout: () => 0,
    clearTimeout: noop,
    Promise,
    JSON,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Boolean,
    Symbol,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Error,
    TypeError,
    RangeError,
  };

  let runtimeError = '';
  try {
    vm.runInNewContext(script, context, { timeout: 5000 });
  } catch (err) {
    runtimeError = (err as Error).message;
  }

  const { creates, appends, flushes } = shim.papi.counters;
  let renderOk = false;
  let errorLog = runtimeError;
  if (!runtimeError) {
    renderOk = creates >= 1 && appends >= 1 && flushes >= 1;
    if (!renderOk) {
      errorLog = `runtime ran without throwing but counters were `
        + `creates=${creates} appends=${appends} flushes=${flushes} — `
        + `make sure to call __flush__() at the end and to actually create and `
        + `append elements via document.createElement + appendChild.`;
    }
  }

  let screenshotPath: string | null = null;
  if (renderOk) {
    const html = shim.papi.toPreviewHTML();
    const p = previewPathFor(ctx);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, html);
    screenshotPath = p;
  }

  return {
    generated_code: generatedCode,
    parse_ok: true,
    render_ok: renderOk,
    error_log: errorLog,
    screenshot_path: screenshotPath,
    visual_score: null,
    visual_rationale: null,
    tokens_used: { input: llmResp.inputTokens, output: llmResp.outputTokens },
  };
}

export const ROUTE_B: Route = { id: 'B', run: runRouteB };
