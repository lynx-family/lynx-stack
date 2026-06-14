// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import ts from 'typescript';

import { callLLM, extractCodeBlock } from '../llm/anthropic-client.ts';
import { createMockPAPI } from '../mocks/mock-papi.ts';
import type { Route, RouteContext, RouteRoundResult } from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PAPI_REFERENCE_PATH = resolvePath(
  __dirname,
  'element-papi-reference.d.ts.txt',
);
let cachedPapiReference: string | null = null;
function loadPapiReference(): string {
  if (cachedPapiReference !== null) return cachedPapiReference;
  cachedPapiReference = readFileSync(PAPI_REFERENCE_PATH, 'utf8');
  return cachedPapiReference;
}

export function buildSystemPrompt(): string {
  return `You are generating Lynx UI code that calls the low-level Element PAPI directly.

Output a single TypeScript code block (triple-backtick fenced \`\`\`typescript ... \`\`\`)
defining \`export function render(rootPageRef: any): void\`. The function MUST:

  1. Use ONLY the global \`__XXX\` functions from the Element PAPI surface below.
  2. Construct an element tree under \`rootPageRef\`.
  3. End with \`__FlushElementTree(rootPageRef)\`.

CONSTRAINTS:
  - DO NOT import anything. DO NOT use \`document\`, \`window\`, or any DOM API.
  - DO NOT use \`innerHTML\` or HTML string literals.
  - Use only PAPI calls listed below.
  - Text content goes through \`__CreateText\` + \`__CreateRawText\` + \`__AppendElement\`.
  - Attributes via \`__SetAttribute\`. Classes via \`__SetClasses\`. Events via \`__AddEvent\`.

Element PAPI surface (full TypeScript declarations):

\`\`\`typescript
${loadPapiReference()}
\`\`\`

If a previous attempt failed, you'll receive the previous code and its error.
Read the error, fix the issue, and emit only the corrected code block. Do not
explain.`;
}

function buildUserPrompt(ctx: RouteContext): string {
  const head = `Generate render() for this UI:\n\n${ctx.prompt.prompt}\n\n`
    + `Expected capabilities: ${ctx.prompt.expected_capabilities.join(', ')}`;
  if (ctx.previous) {
    return `${head}\n\n---\nPrevious attempt (failed):\n\`\`\`typescript\n${ctx.previous.generated_code}\n\`\`\`\n\nError log:\n${ctx.previous.error_log}\n\nProduce a corrected version.`;
  }
  return head;
}

function parseTypeScript(source: string): { ok: boolean; diagnostics: string } {
  const sf = ts.createSourceFile(
    'route-a.ts',
    source,
    ts.ScriptTarget.ES2022,
    /*setParentNodes*/ false,
    ts.ScriptKind.TS,
  );
  // sf.parseDiagnostics is internal API but reliable; cast through unknown.
  const diags =
    ((sf as unknown) as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics
      ?? [];
  if (diags.length === 0) return { ok: true, diagnostics: '' };
  const formatted = diags
    .map(d =>
      `[ts ${d.code}] ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`
    )
    .join('\n');
  return { ok: false, diagnostics: formatted };
}

function runInMockPAPI(
  source: string,
  papi: ReturnType<typeof createMockPAPI>,
): { ok: boolean; error: string } {
  // The LLM emits TypeScript (typed params, return types, possibly enums).
  // vm.runInNewContext executes pure JS, so transpile types out first.
  //
  // We strip `export` BEFORE transpile so the transpiler treats the file as a
  // plain script (no module emit machinery). `module: None` alone doesn't stop
  // ts from inserting `exports.X = ...` lines when it sees an `export` keyword
  // in source; those would crash in vm where `exports` is undefined.
  const stripped = source.replace(/\bexport\s+/g, '');
  let transpiled: string;
  try {
    const out = ts.transpileModule(stripped, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None,
        removeComments: false,
        isolatedModules: false,
      },
      reportDiagnostics: false,
    });
    transpiled = out.outputText;
  } catch (err) {
    return {
      ok: false,
      error: `ts.transpileModule failed: ${(err as Error).message}`,
    };
  }
  const wrapped =
    `${transpiled}\n\ntry { render(__CreatePage('mock', 0)); } catch (e) { __ROUTE_ERROR__ = e; }`;
  const context: Record<string, unknown> = {
    ...papi.globals,
    __ROUTE_ERROR__: undefined,
    console: (() => {
      const noop = (): void => {
        void 0;
      };
      return { log: noop, info: noop, error: noop, warn: noop };
    })(),
  };
  try {
    vm.runInNewContext(wrapped, context, { timeout: 5000 });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const captured = context['__ROUTE_ERROR__'];
  if (captured) {
    const msg = captured instanceof Error
      ? captured.message
      : (typeof captured === 'object' && captured !== null
          && 'message' in captured
        ? String((captured as { message: unknown }).message)
        : 'unknown route error');
    return { ok: false, error: msg };
  }
  return { ok: true, error: '' };
}

function previewPathFor(ctx: RouteContext): string {
  return resolvePath(
    ctx.out_dir,
    'previews',
    `${ctx.prompt.id}-A-r${ctx.round}.html`,
  );
}

async function runRouteA(ctx: RouteContext): Promise<RouteRoundResult> {
  if (ctx.dry_run) {
    return {
      generated_code:
        `// dry-run stub for route A — ${ctx.prompt.id} round ${ctx.round}`,
      parse_ok: true,
      render_ok: true,
      error_log: '',
      screenshot_path: null,
      visual_score: null,
      visual_rationale: null,
    };
  }

  const llmResp = await callLLM({
    system: buildSystemPrompt(),
    user: buildUserPrompt(ctx),
    model: ctx.model_id,
  });
  const generatedCode = extractCodeBlock(llmResp.text);

  const parseResult = parseTypeScript(generatedCode);
  if (!parseResult.ok) {
    return {
      generated_code: generatedCode,
      parse_ok: false,
      render_ok: false,
      error_log: parseResult.diagnostics,
      screenshot_path: null,
      visual_score: null,
      visual_rationale: null,
      tokens_used: {
        input: llmResp.inputTokens,
        output: llmResp.outputTokens,
      },
    };
  }

  const papi = createMockPAPI();
  const runResult = runInMockPAPI(generatedCode, papi);

  let renderOk = false;
  let errorLog = runResult.error;
  if (runResult.ok) {
    const { creates, appends, flushes } = papi.counters;
    renderOk = creates >= 1 && appends >= 1 && flushes >= 1;
    if (!renderOk) {
      errorLog = `runtime ran without throwing but counters were `
        + `creates=${creates} appends=${appends} flushes=${flushes} — need all >= 1`;
    }
  }

  let screenshotPath: string | null = null;
  if (renderOk) {
    const html = papi.toPreviewHTML();
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
    tokens_used: {
      input: llmResp.inputTokens,
      output: llmResp.outputTokens,
    },
  };
}

export const ROUTE_A: Route = { id: 'A', run: runRouteA };
