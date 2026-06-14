// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import {
  L1ReadOnlyText,
  NODE_TYPE_TEXT,
  recordTextValue,
  wrapPapi,
} from '../nodes.ts';

interface MockNode extends Record<string, unknown> {
  tag: string;
  children: MockNode[];
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockNode) => n.tag;
  g['__GetChildren'] = (n: MockNode) => n.children;
  g['__FirstElement'] = (n: MockNode) =>
    n.children.length > 0 ? n.children[0] : undefined;
}

describe('US-410 L1ReadOnlyText nodeValue', () => {
  beforeAll(() => {
    installPapi();
  });

  it('nodeType is TEXT_NODE (3)', () => {
    const ref: MockNode = { tag: 'raw-text', children: [] };
    const node = wrapPapi(ref);
    expect(node).toBeInstanceOf(L1ReadOnlyText);
    expect(node.nodeType).toBe(NODE_TYPE_TEXT);
  });

  it('nodeName is #text', () => {
    const ref: MockNode = { tag: 'raw-text', children: [] };
    expect(wrapPapi(ref).nodeName).toBe('#text');
  });

  it('firstChild is null (raw-text has no children)', () => {
    const ref: MockNode = { tag: 'raw-text', children: [] };
    const text = wrapPapi(ref);
    expect(text.firstChild).toBeNull();
  });

  it('nodeValue defaults to empty string when never recorded', () => {
    const ref: MockNode = { tag: 'raw-text', children: [] };
    const text = wrapPapi(ref);
    expect(text.nodeValue).toBe('');
  });

  it('nodeValue reflects recorded value after recordTextValue', () => {
    const ref: MockNode = { tag: 'raw-text', children: [] };
    recordTextValue(ref, 'hello world');
    const text = wrapPapi(ref);
    expect(text.nodeValue).toBe('hello world');
  });

  it('nodeValue can be re-recorded (US-446 textContent path)', () => {
    const ref: MockNode = { tag: 'raw-text', children: [] };
    recordTextValue(ref, 'first');
    expect(wrapPapi(ref).nodeValue).toBe('first');
    recordTextValue(ref, 'second');
    expect(wrapPapi(ref).nodeValue).toBe('second');
  });
});
