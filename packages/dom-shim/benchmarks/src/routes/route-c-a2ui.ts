// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import { callLLM, extractCodeBlock } from '../llm/anthropic-client.ts';
import { createMockPAPI } from '../mocks/mock-papi.ts';
import type { MockElement, MockPAPIInstance } from '../mocks/mock-papi.ts';
import type { Route, RouteContext, RouteRoundResult } from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_PATH = resolvePath(__dirname, 'route-c-schema.json');
let cachedValidator: ((data: unknown) => boolean) | null = null;
const cachedValidatorErrors: { errors: unknown } = { errors: null };

function getValidator(): (data: unknown) => boolean {
  if (cachedValidator) return cachedValidator;
  const schema: unknown = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv.default({ allErrors: true, strict: false });
  addFormats.default(ajv);
  const compiled = ajv.compile(schema as object);
  cachedValidator = (data: unknown): boolean => {
    const result = compiled(data);
    cachedValidatorErrors.errors = compiled.errors;
    return result;
  };
  return cachedValidator;
}

interface ElementNode {
  tag: string;
  id?: string;
  class?: string;
  style?: Record<string, string | number>;
  attrs?: Record<string, string | number | boolean | null>;
  events?: Record<string, string>;
  children?: Array<ElementNode | TextNode>;
}
interface TextNode {
  text: string;
}
type Node = ElementNode | TextNode;

const SYSTEM_PROMPT = `You are generating Lynx UI as an A2UI-style JSON tree.

Output a single JSON code block (triple-backtick fenced \`\`\`json ... \`\`\`).

The root must be a single ElementNode with tag "page". The schema:

  ElementNode = {
    "tag": "page" | "view" | "text" | "image" | "scroll-view" | "list" | "input" | "button",
    "id"?: string,
    "class"?: string,
    "style"?: { [cssProperty]: string | number },
    "attrs"?: { [name]: string | number | boolean | null },
    "events"?: { [eventName]: handlerName },
    "children"?: Array<ElementNode | TextNode>
  }
  TextNode = { "text": string }

Use TextNode for any visible text content. Wrap text in a parent ElementNode
with tag "text" when you want it styled as Lynx text.

CONSTRAINTS:
  - Output only valid JSON. No comments, no trailing commas.
  - additionalProperties is rejected by the validator.
  - Event handler bodies are not allowed; only string names. The benchmark
    doesn't execute event handlers, but their presence is observed.

If a previous attempt failed, you'll receive the previous JSON and its
error. Read the error, fix the issue, and emit only the corrected JSON
block. Do not explain.`;

function buildUserPrompt(ctx: RouteContext): string {
  const head = `Generate the JSON tree for this UI:\n\n${ctx.prompt.prompt}\n\n`
    + `Expected capabilities: ${ctx.prompt.expected_capabilities.join(', ')}`;
  if (ctx.previous) {
    return `${head}\n\n---\nPrevious attempt (failed):\n\`\`\`json\n${ctx.previous.generated_code}\n\`\`\`\n\nError log:\n${ctx.previous.error_log}\n\nProduce a corrected version.`;
  }
  return head;
}

function isTextNode(n: Node): n is TextNode {
  return 'text' in n;
}

function walk(
  papi: MockPAPIInstance,
  node: Node,
  parent: MockElement | null,
): void {
  if (isTextNode(node)) {
    const raw = (papi.globals['__CreateRawText'] as (s: string) => MockElement)(
      node.text,
    );
    if (parent) {
      (papi.globals['__AppendElement'] as (
        p: MockElement,
        c: MockElement,
      ) => MockElement)(
        parent,
        raw,
      );
    }
    return;
  }

  let el: MockElement;
  if (node.tag === 'page') {
    el = (papi.globals['__CreatePage'] as (
      id: string,
      css: number,
    ) => MockElement)(
      'mock',
      0,
    );
  } else {
    el = createTaggedElement(papi, node.tag);
  }

  if (node.id) {
    (papi.globals['__SetID'] as (e: MockElement, s: string) => void)(
      el,
      node.id,
    );
  }
  if (node.class) {
    (papi.globals['__SetClasses'] as (e: MockElement, s: string) => void)(
      el,
      node.class,
    );
  }
  if (node.style) {
    (papi.globals['__SetInlineStyles'] as (e: MockElement, v: unknown) => void)(
      el,
      node.style,
    );
  }
  if (node.attrs) {
    for (const [k, v] of Object.entries(node.attrs)) {
      (papi.globals['__SetAttribute'] as (
        e: MockElement,
        n: string,
        v: unknown,
      ) => void)(
        el,
        k,
        v,
      );
    }
  }
  if (node.events) {
    for (const [event, name] of Object.entries(node.events)) {
      (papi.globals['__AddEvent'] as (
        e: MockElement,
        t: string,
        n: string,
        h: unknown,
      ) => void)(el, 'bindEvent', event, name);
    }
  }

  if (parent) {
    (papi.globals['__AppendElement'] as (
      p: MockElement,
      c: MockElement,
    ) => MockElement)(
      parent,
      el,
    );
  }

  if (node.children) {
    for (const child of node.children) {
      walk(papi, child, el);
    }
  }
}

function createTaggedElement(papi: MockPAPIInstance, tag: string): MockElement {
  switch (tag) {
    case 'view':
      return (papi.globals['__CreateView'] as (n?: number) => MockElement)(0);
    case 'text':
      return (papi.globals['__CreateText'] as (n?: number) => MockElement)(0);
    case 'image':
      return (papi.globals['__CreateImage'] as (n?: number) => MockElement)(0);
    case 'scroll-view':
      return (papi.globals['__CreateScrollView'] as (
        n?: number,
      ) => MockElement)(0);
    case 'list':
      return (papi.globals['__CreateList'] as (n?: number) => MockElement)(0);
    default:
      return (
        papi.globals['__CreateElement'] as (
          t: string,
          n?: number,
        ) => MockElement
      )(tag, 0);
  }
}

function previewPathFor(ctx: RouteContext): string {
  return resolvePath(
    ctx.out_dir,
    'previews',
    `${ctx.prompt.id}-C-r${ctx.round}.html`,
  );
}

async function runRouteC(ctx: RouteContext): Promise<RouteRoundResult> {
  if (ctx.dry_run) {
    return {
      generated_code:
        `{"tag":"page","children":[{"tag":"text","children":[{"text":"dry-run stub for route C — ${ctx.prompt.id} round ${ctx.round}"}]}]}`,
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

  // Step 1: JSON parse.
  let parsed: unknown;
  try {
    parsed = JSON.parse(generatedCode);
  } catch (err) {
    return {
      generated_code: generatedCode,
      parse_ok: false,
      render_ok: false,
      error_log: `JSON.parse: ${(err as Error).message}`,
      screenshot_path: null,
      visual_score: null,
      visual_rationale: null,
      tokens_used: { input: llmResp.inputTokens, output: llmResp.outputTokens },
    };
  }

  // Step 2: schema validate.
  const validate = getValidator();
  if (!validate(parsed)) {
    return {
      generated_code: generatedCode,
      parse_ok: false,
      render_ok: false,
      error_log: `Schema validation: ${
        JSON.stringify(cachedValidatorErrors.errors)
      }`,
      screenshot_path: null,
      visual_score: null,
      visual_rationale: null,
      tokens_used: { input: llmResp.inputTokens, output: llmResp.outputTokens },
    };
  }

  // Step 3: walk into mock PAPI.
  const papi = createMockPAPI();
  let walkErr = '';
  try {
    walk(papi, parsed as Node, null);
    (papi.globals['__FlushElementTree'] as () => void)();
  } catch (err) {
    walkErr = (err as Error).message;
  }

  const { creates, appends, flushes } = papi.counters;
  let renderOk = false;
  let errorLog = walkErr;
  if (!walkErr) {
    renderOk = creates >= 1 && appends >= 1 && flushes >= 1;
    if (!renderOk) {
      errorLog = `walker ran without throwing but counters were `
        + `creates=${creates} appends=${appends} flushes=${flushes} — `
        + `the root must be an ElementNode with tag "page" containing children.`;
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
    tokens_used: { input: llmResp.inputTokens, output: llmResp.outputTokens },
  };
}

export const ROUTE_C: Route = { id: 'C', run: runRouteC };
