// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  defineCatalog,
  mergeCatalogs,
  resolveCatalog,
  serializeCatalog,
} from '../src/catalog/defineCatalog.js';
import type {
  CatalogComponent,
  CatalogManifest,
} from '../src/catalog/defineCatalog.js';

function namedStub(name: string): CatalogComponent {
  // Use Object.defineProperty to give a stable function name across
  // engines (function expressions can otherwise inherit the variable name).
  const fn = (() => null) as unknown as CatalogComponent;
  Object.defineProperty(fn, 'name', { value: name });
  return fn;
}

const Text = namedStub('Text');
const Button = namedStub('Button');

const TEXT_MANIFEST: CatalogManifest = {
  Text: { type: 'object', properties: { text: { type: 'string' } } },
};
const BUTTON_MANIFEST: CatalogManifest = {
  Button: { type: 'object', properties: { child: { type: 'string' } } },
};

describe('defineCatalog', () => {
  test('bare component derives name from displayName ?? function name', () => {
    const cat = defineCatalog([Text, Button]);
    expect(cat.map((e) => e.name)).toEqual(['Text', 'Button']);
    expect(cat[0]!.component).toBe(Text);
    expect(cat[0]!.schema).toBeUndefined();
  });

  test('tuple form derives name + schema from manifest', () => {
    const cat = defineCatalog([
      [Text, TEXT_MANIFEST],
      [Button, BUTTON_MANIFEST],
    ]);
    expect(cat[0]!.name).toBe('Text');
    expect(cat[0]!.schema).toEqual(TEXT_MANIFEST.Text);
    expect(cat[1]!.name).toBe('Button');
    expect(cat[1]!.schema).toEqual(BUTTON_MANIFEST.Button);
  });

  test('mixes bare and tuple inputs in one call', () => {
    const cat = defineCatalog([Text, [Button, BUTTON_MANIFEST]]);
    expect(cat[0]!.schema).toBeUndefined();
    expect(cat[1]!.schema).toEqual(BUTTON_MANIFEST.Button);
  });

  test('passes through already-resolved entries', () => {
    const inner = defineCatalog([[Text, TEXT_MANIFEST]]);
    const outer = defineCatalog(inner);
    expect(outer).toEqual(inner);
  });

  test('rejects duplicate names', () => {
    expect(() => defineCatalog([Text, Text])).toThrow(/Duplicate/);
  });

  test('rejects components with no derivable name', () => {
    const anonymous = (() => null) as unknown as CatalogComponent;
    Object.defineProperty(anonymous, 'name', { value: '' });
    expect(() => defineCatalog([anonymous])).toThrow(/displayName/);
  });

  test('respects displayName when set', () => {
    const fn = (() => null) as unknown as CatalogComponent;
    Object.defineProperty(fn, 'name', { value: 'Mangled' });
    (fn as { displayName?: string }).displayName = 'Custom';
    const cat = defineCatalog([fn]);
    expect(cat[0]!.name).toBe('Custom');
  });
});

describe('mergeCatalogs', () => {
  test('last-write-wins on duplicate names', () => {
    const a = defineCatalog([[Text, TEXT_MANIFEST]]);
    const Override = namedStub('Text');
    const b = defineCatalog([Override]);
    const merged = mergeCatalogs(a, b);
    const text = merged.find((e) => e.name === 'Text')!;
    expect(text.component).toBe(Override);
    expect(text.schema).toBeUndefined();
  });
});

describe('resolveCatalog', () => {
  test('returns a name → component map', () => {
    const cat = defineCatalog([Text, Button]);
    const map = resolveCatalog(cat);
    expect(map.get('Text')).toBe(Text);
    expect(map.get('Button')).toBe(Button);
  });
});

describe('serializeCatalog', () => {
  test('emits version + components, omitting schema when absent', () => {
    const cat = defineCatalog([Text]);
    const out = serializeCatalog(cat);
    expect(out.version).toBe('0.9');
    expect(out.components).toEqual([{ name: 'Text' }]);
  });

  test('attaches schema when present', () => {
    const cat = defineCatalog([[Text, TEXT_MANIFEST]]);
    const out = serializeCatalog(cat);
    expect(out.components[0]).toEqual({
      name: 'Text',
      schema: TEXT_MANIFEST.Text,
    });
  });
});

describe('user composes their own all-builtins catalog', () => {
  // Snapshot of the recipe documented in
  // packages/genui/a2ui/src/catalog/README.md. If you change this list,
  // update the README too.
  test('paste-able recipe builds the expected manifest', () => {
    const all = defineCatalog([
      [Text, TEXT_MANIFEST],
      [Button, BUTTON_MANIFEST],
    ]);
    const manifest = serializeCatalog(all);
    expect(manifest.components.map((c) => c.name)).toEqual(['Text', 'Button']);
    expect(manifest.components.every((c) => c.schema)).toBe(true);
  });
});
