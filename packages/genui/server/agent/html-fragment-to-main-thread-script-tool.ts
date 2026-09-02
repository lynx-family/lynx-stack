// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createTool } from '@mastra/core/tools';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';

const FRAGMENT_ROOT = 'genui-fragment';
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
  lines: string[];
  nextNodeIndex: number;
}

type OrderedXmlNode = Record<string, unknown>;

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

/** Convert an XML element fragment into Element PAPI calls for renderPage(). */
export function generateMainThreadScript(xmlFragment: string): string {
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

  const state: GeneratorState = { lines: [], nextNodeIndex: 0 };
  for (const child of children) {
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      throw new Error('XML fragment contains an unsupported node');
    }
    appendParsedNode(child as OrderedXmlNode, 'page', undefined, state, 1);
  }
  if (state.lines.length === 0) {
    throw new Error('XML fragment must contain visible content');
  }
  return state.lines.join('\n');
}

const inputSchema = z.object({
  xmlFragment: z.string().min(1).max(MAX_XML_FRAGMENT_LENGTH).describe(
    'A well-formed XML fragment containing the Lynx elements to create.',
  ),
});

const outputSchema = z.object({
  javascript: z.string().min(1).describe(
    'Element PAPI JavaScript statements to place inside renderPage().',
  ),
});

/** Create the Mastra tool that converts XML fragments into Element PAPI code. */
export function createHtmlFragmentToMainThreadScriptTool() {
  return createTool({
    id: 'html_fragment_to_main_thread_script',
    description:
      'Convert an HTML-like, well-formed XML fragment into deterministic Element PAPI JavaScript for the Lynx main-thread renderPage function. The result assumes page and pageId already exist. It creates and appends elements, text, classes, IDs, inline styles, datasets, and attributes; event handlers and lifecycle code remain the agent\'s responsibility.',
    inputSchema,
    outputSchema,
    execute: async ({ xmlFragment }) => ({
      javascript: generateMainThreadScript(xmlFragment),
    }),
  });
}
