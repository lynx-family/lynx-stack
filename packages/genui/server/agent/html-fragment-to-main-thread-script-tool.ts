// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';

const FRAGMENT_ROOT = 'genui-fragment';
const FRAGMENT_SCRIPT_RUN_STATE_KEY =
  'lynx-xml:html-fragment-script-run-state' as const;
const FRAGMENT_SCRIPT_PLACEHOLDER_PATTERN =
  /^\/\*__GENUI_HTML_FRAGMENT_[0-9a-f-]{36}__\*\/$/u;
const FRAGMENT_SCRIPT_PLACEHOLDER_IN_SOURCE_PATTERN =
  /\/\*__GENUI_HTML_FRAGMENT_[0-9a-f-]{36}__\*\//gu;
const MAX_XML_FRAGMENT_DEPTH = 64;
const MAX_XML_FRAGMENT_LENGTH = 100_000;
const TEXT_NODE_NAME = '#text';
const ATTRIBUTE_NODE_NAME = ':@';

const ELEMENT_FACTORIES: Readonly<Record<string, string>> = {
  frame: '__CreateFrame',
  image: '__CreateImage',
  'scroll-view': '__CreateScrollView',
  text: '__CreateText',
  view: '__CreateView',
  wrapper: '__CreateWrapperElement',
};
const FORBIDDEN_FRAGMENT_ELEMENTS = new Set([
  'lynx',
  'page',
  'raw-text',
  'script',
  'style',
]);

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
});

interface GeneratorState {
  bindings: Map<string, string>;
  lines: string[];
  nextNodeIndex: number;
}

interface GeneratedMainThreadScript {
  bindings: Record<string, string>;
  javascript: string;
}

interface FragmentScriptReplacement {
  javascript: string;
  placeholder: string;
}

interface FragmentScriptRunState {
  replacements: FragmentScriptReplacement[];
}

type FragmentScriptRequestContextValues = Record<
  typeof FRAGMENT_SCRIPT_RUN_STATE_KEY,
  FragmentScriptRunState
>;

export interface HtmlFragmentScriptRunScope {
  requestContext: RequestContext<FragmentScriptRequestContextValues>;
}

type OrderedXmlNode = Record<string, unknown>;

/** Create isolated storage for fragment scripts generated during one run. */
export function createHtmlFragmentScriptRunScope(): HtmlFragmentScriptRunScope {
  const requestContext = new RequestContext<
    FragmentScriptRequestContextValues
  >();
  requestContext.set(FRAGMENT_SCRIPT_RUN_STATE_KEY, { replacements: [] });
  return { requestContext };
}

/** Count exact, non-overlapping occurrences of a value. */
function countOccurrences(source: string, value: string): number {
  let count = 0;
  let offset = 0;
  while (offset < source.length) {
    const next = source.indexOf(value, offset);
    if (next === -1) break;
    count++;
    offset = next + value.length;
  }
  return count;
}

/** Escape a literal string for use in a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Replace registered fragment placeholders before final artifact delivery. */
export function resolveHtmlFragmentScriptPlaceholders(
  scope: HtmlFragmentScriptRunScope,
  source: string,
): string {
  const state = scope.requestContext.get(FRAGMENT_SCRIPT_RUN_STATE_KEY);
  if (!state) {
    throw new Error('HTML fragment script run scope is not initialized');
  }

  const knownPlaceholders = new Set(
    state.replacements.map((replacement) => replacement.placeholder),
  );
  const unknownPlaceholder = source.match(
    FRAGMENT_SCRIPT_PLACEHOLDER_IN_SOURCE_PATTERN,
  )?.find((placeholder) => !knownPlaceholders.has(placeholder));
  if (unknownPlaceholder) {
    throw new Error(
      'Lynx XML artifact contains an unknown fragment placeholder',
    );
  }

  let resolved = source;
  for (const replacement of state.replacements) {
    if (countOccurrences(resolved, replacement.placeholder) !== 1) {
      throw new Error(
        'Each generated fragment placeholder must appear exactly once',
      );
    }
    const standalonePlaceholder = new RegExp(
      `^[\\t ]*${escapeRegExp(replacement.placeholder)}[\\t ]*\\r?$`,
      'mu',
    );
    if (!standalonePlaceholder.test(resolved)) {
      throw new Error(
        'Each generated fragment placeholder must appear on its own line',
      );
    }
    resolved = resolved.replace(
      replacement.placeholder,
      replacement.javascript,
    );
  }
  return resolved;
}

/** Escape a value for safe inclusion in an inline main-thread script. */
function javascriptString(value: string): string {
  return JSON.stringify(value).replace(
    /<\/script/giu,
    (match) => `<\\/${match.slice(2)}`,
  );
}

/** Return the Element PAPI expression that creates one XML element. */
function createElementExpression(tagName: string): string {
  const factory = ELEMENT_FACTORIES[tagName];
  return factory
    ? `${factory}(pageId)`
    : `__CreateElement(${javascriptString(tagName)}, pageId)`;
}

/** Emit a non-empty text node while preserving its original whitespace. */
function appendText(
  text: string,
  parent: string,
  parentTagName: string | undefined,
  state: GeneratorState,
): void {
  if (!text.trim()) return;

  if (parentTagName === 'text') {
    state.lines.push(
      `__AppendElement(${parent}, __CreateRawText(${javascriptString(text)}));`,
    );
    return;
  }

  const node = `node${state.nextNodeIndex++}`;
  state.lines.push(
    `const ${node} = __CreateText(pageId);`,
    `__AppendElement(${node}, __CreateRawText(${javascriptString(text)}));`,
    `__AppendElement(${parent}, ${node});`,
  );
}

/** Emit the Element PAPI call for one literal XML attribute. */
function appendAttribute(
  node: string,
  name: string,
  rawValue: unknown,
  state: GeneratorState,
): void {
  const value = javascriptString(String(rawValue));
  if (name === 'class') {
    state.lines.push(`__SetClasses(${node}, ${value});`);
  } else if (name === 'id') {
    const bindingName = String(rawValue);
    if (state.bindings.has(bindingName)) {
      throw new Error(`Duplicate XML id: ${bindingName}`);
    }
    state.bindings.set(bindingName, node);
    state.lines.push(`__SetID(${node}, ${value});`);
  } else if (name === 'style') {
    state.lines.push(`__SetInlineStyles(${node}, ${value});`);
  } else if (name.startsWith('data-') && name.length > 5) {
    state.lines.push(
      `__AddDataset(${node}, ${javascriptString(name.slice(5))}, ${value});`,
    );
  } else {
    state.lines.push(
      `__SetAttribute(${node}, ${javascriptString(name)}, ${value});`,
    );
  }
}

/** Emit one parsed XML node and its depth-bounded descendants. */
function appendParsedNode(
  parsedNode: OrderedXmlNode,
  parent: string,
  parentTagName: string | undefined,
  state: GeneratorState,
  depth: number,
): void {
  const entries = Object.entries(parsedNode).filter(
    ([name]) => name !== ATTRIBUTE_NODE_NAME,
  );
  if (entries.length !== 1) {
    throw new Error('XML fragment contains an unsupported node');
  }

  const [tagName, children] = entries[0]!;
  if (tagName === TEXT_NODE_NAME) {
    appendText(String(children), parent, parentTagName, state);
    return;
  }
  if (depth > MAX_XML_FRAGMENT_DEPTH) {
    throw new Error(
      `XML fragment must not exceed ${MAX_XML_FRAGMENT_DEPTH} levels of element nesting`,
    );
  }
  if (!/^[a-z][a-z0-9-]*$/u.test(tagName)) {
    throw new Error(`Unsupported XML element: ${tagName}`);
  }
  if (FORBIDDEN_FRAGMENT_ELEMENTS.has(tagName)) {
    throw new Error(`Element <${tagName}> is not allowed in the XML fragment`);
  }
  if (!Array.isArray(children)) {
    throw new Error(`Invalid parsed children for <${tagName}>`);
  }

  const node = `node${state.nextNodeIndex++}`;
  state.lines.push(`const ${node} = ${createElementExpression(tagName)};`);

  const attributes = parsedNode[ATTRIBUTE_NODE_NAME];
  if (attributes && typeof attributes === 'object') {
    for (const [name, value] of Object.entries(attributes)) {
      appendAttribute(node, name, value, state);
    }
  }

  for (const child of children) {
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      throw new Error(`Invalid parsed child in <${tagName}>`);
    }
    appendParsedNode(child as OrderedXmlNode, node, tagName, state, depth + 1);
  }
  state.lines.push(`__AppendElement(${parent}, ${node});`);
}

/** Generate Element PAPI calls and stable id-to-node bindings. */
function generateMainThreadScriptResult(
  xmlFragment: string,
): GeneratedMainThreadScript {
  if (!xmlFragment.trim()) throw new Error('XML fragment must not be empty');
  if (xmlFragment.length > MAX_XML_FRAGMENT_LENGTH) {
    throw new Error(
      `XML fragment must not exceed ${MAX_XML_FRAGMENT_LENGTH} characters`,
    );
  }

  const wrappedFragment = `<${FRAGMENT_ROOT}>${xmlFragment}</${FRAGMENT_ROOT}>`;
  const validation = XMLValidator.validate(wrappedFragment);
  if (validation !== true) {
    throw new Error(`Invalid XML fragment: ${validation.err.msg}`);
  }

  const parsed = parser.parse(wrappedFragment) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error('XML fragment could not be parsed');
  }
  const root = parsed[0] as OrderedXmlNode;
  const children = root[FRAGMENT_ROOT];
  if (!Array.isArray(children)) {
    throw new Error('XML fragment could not be parsed');
  }

  const state: GeneratorState = {
    bindings: new Map(),
    lines: [],
    nextNodeIndex: 0,
  };
  for (const child of children) {
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      throw new Error('XML fragment contains an unsupported node');
    }
    appendParsedNode(child as OrderedXmlNode, 'page', undefined, state, 1);
  }
  if (state.lines.length === 0) {
    throw new Error('XML fragment must contain visible content');
  }
  return {
    bindings: Object.fromEntries(state.bindings),
    javascript: state.lines.join('\n'),
  };
}

/** Convert an XML element fragment into Element PAPI calls for renderPage(). */
export function generateMainThreadScript(xmlFragment: string): string {
  return generateMainThreadScriptResult(xmlFragment).javascript;
}

/** Store one generated script and return its model-visible indirection data. */
function registerHtmlFragmentScript(
  requestContext: RequestContext<FragmentScriptRequestContextValues>,
  generated: GeneratedMainThreadScript,
): { bindings: Record<string, string>; placeholder: string } {
  const state = requestContext.get(FRAGMENT_SCRIPT_RUN_STATE_KEY);
  if (!state) {
    throw new Error('HTML fragment script run scope is not initialized');
  }
  if (state.replacements.length > 0) {
    throw new Error(
      'HTML fragment conversion may only be called once per agent run',
    );
  }

  const placeholder = `/*__GENUI_HTML_FRAGMENT_${crypto.randomUUID()}__*/`;
  requestContext.set(FRAGMENT_SCRIPT_RUN_STATE_KEY, {
    replacements: [...state.replacements, {
      javascript: generated.javascript,
      placeholder,
    }],
  });
  return { bindings: generated.bindings, placeholder };
}

const inputSchema = z.object({
  xmlFragment: z.string().min(1).max(MAX_XML_FRAGMENT_LENGTH).describe(
    'A well-formed XML fragment containing the Lynx elements to create.',
  ),
});

const outputSchema = z.object({
  placeholder: z.string().regex(FRAGMENT_SCRIPT_PLACEHOLDER_PATTERN).describe(
    'An opaque comment marker to copy exactly once onto its own line inside renderPage(). The server replaces it with generated Element PAPI JavaScript after model generation.',
  ),
  bindings: z.record(z.string(), z.string().regex(/^node\d+$/u)).describe(
    'A map from XML id attributes to generated JavaScript node variable names for event handlers and updates.',
  ),
});

const requestContextSchema = z.object({
  [FRAGMENT_SCRIPT_RUN_STATE_KEY]: z.object({
    replacements: z.array(z.object({
      javascript: z.string().min(1),
      placeholder: z.string().regex(FRAGMENT_SCRIPT_PLACEHOLDER_PATTERN),
    })).max(1),
  }),
});

/** Create the Mastra tool that converts XML fragments into Element PAPI code. */
export function createHtmlFragmentToMainThreadScriptTool() {
  return createTool({
    id: 'html_fragment_to_main_thread_script',
    description:
      'Convert one HTML-like, well-formed XML fragment into server-held Element PAPI JavaScript. Returns only an opaque placeholder to copy exactly once onto its own line inside renderPage(), plus bindings from XML id attributes to generated node variables. The server replaces the placeholder after model generation, so never expand or rewrite it. Event handlers and lifecycle code remain the agent\'s responsibility.',
    inputSchema,
    outputSchema,
    requestContextSchema,
    execute: async ({ xmlFragment }, context) =>
      registerHtmlFragmentScript(
        context.requestContext as RequestContext<
          FragmentScriptRequestContextValues
        >,
        generateMainThreadScriptResult(xmlFragment),
      ),
  });
}
