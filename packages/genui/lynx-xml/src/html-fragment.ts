// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { XMLParser, XMLValidator } from 'fast-xml-parser';

const FRAGMENT_ROOT = 'genui-fragment';
const MAX_XML_FRAGMENT_DEPTH = 64;
export const MAX_XML_FRAGMENT_LENGTH = 100_000;
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
}

export interface GeneratedMainThreadScript {
  /** Only explicit XML ids are retained in the runtime nodeMap. */
  bindings: Record<string, string>;
  javascript: string;
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

  state.lines.push(
    'element = __CreateText(pageId);',
    `__AppendElement(element, __CreateRawText(${javascriptString(text)}));`,
    `__AppendElement(${parent}, element);`,
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
    const reference = `nodeMap[${value}]`;
    state.bindings.set(bindingName, reference);
    state.lines.push(`${reference} = ${node};`, `__SetID(${node}, ${value});`);
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

/** Explicit raw-text is a text leaf, not an element created with pageId. */
function appendRawText(
  children: unknown[],
  attributes: OrderedXmlNode,
  parent: string,
  parentTagName: string | undefined,
  state: GeneratorState,
): void {
  const parts = children.map(child => {
    if (
      !child || typeof child !== 'object' || Array.isArray(child)
      || Object.keys(child).length !== 1 || !(TEXT_NODE_NAME in child)
    ) {
      throw new Error(
        'XML raw-text must contain only literal text, not child elements',
      );
    }
    return String((child as OrderedXmlNode)[TEXT_NODE_NAME]);
  });
  const body = parts.join('');
  if (Object.hasOwn(attributes, 'text') && body.trim()) {
    throw new Error(
      'XML raw-text must use either the text attribute or text content, not both',
    );
  }
  const text = Object.hasOwn(attributes, 'text')
    ? String(attributes['text'])
    : body;
  const unsupported = Object.keys(attributes).find(name =>
    name !== 'text' && name !== 'id'
  );
  if (unsupported) {
    throw new Error(
      `XML raw-text does not support attribute "${unsupported}"; put styling and events on its parent text element`,
    );
  }
  if (parentTagName !== 'text') {
    state.lines.push(
      'element = __CreateText(pageId);',
      `__AppendElement(${parent}, element);`,
      'parents.push(element);',
    );
  }
  state.lines.push(`element = __CreateRawText(${javascriptString(text)});`);
  if (Object.hasOwn(attributes, 'id')) {
    appendAttribute('element', 'id', attributes['id'], state);
  }
  state.lines.push(`__AppendElement(parents[parents.length - 1], element);`);
  if (parentTagName !== 'text') state.lines.push('parents.pop();');
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

  const attributes = parsedNode[ATTRIBUTE_NODE_NAME];
  if (tagName === 'raw-text') {
    appendRawText(
      children,
      attributes && typeof attributes === 'object'
        ? attributes as OrderedXmlNode
        : {},
      parent,
      parentTagName,
      state,
    );
    return;
  }

  const node = 'element';
  state.lines.push(`${node} = ${createElementExpression(tagName)};`);

  if (attributes && typeof attributes === 'object') {
    for (const [name, value] of Object.entries(attributes)) {
      appendAttribute(node, name, value, state);
    }
  }

  state.lines.push(
    `__AppendElement(${parent}, ${node});`,
    `parents.push(${node});`,
  );
  for (const child of children) {
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      throw new Error(`Invalid parsed child in <${tagName}>`);
    }
    appendParsedNode(
      child as OrderedXmlNode,
      'parents[parents.length - 1]',
      tagName,
      state,
      depth + 1,
    );
  }
  state.lines.push('parents.pop();');
}

/** Generate Element PAPI calls and stable id-to-node bindings. */
export function generateMainThreadScriptResult(
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
  };
  for (const child of children) {
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      throw new Error('XML fragment contains an unsupported node');
    }
    appendParsedNode(
      child as OrderedXmlNode,
      'parents[parents.length - 1]',
      undefined,
      state,
      1,
    );
  }
  if (state.lines.length === 0) {
    throw new Error('XML fragment must contain visible content');
  }
  return {
    bindings: Object.fromEntries(state.bindings),
    javascript: [
      'const nodeMap = Object.create(null);',
      'const parents = [page];',
      'let element;',
      ...state.lines,
    ].join('\n'),
  };
}

/** Convert an XML element fragment into Element PAPI calls for renderPage(). */
export function generateMainThreadScript(xmlFragment: string): string {
  return generateMainThreadScriptResult(xmlFragment).javascript;
}
