// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L1ReadOnlyElement } from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  data: Record<string, unknown>;
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetDataset'] = (n: MockEl) => n.data;
  g['__GetDataByKey'] = (n: MockEl, k: string) => n.data[k];
}

function el(data: Record<string, unknown> = {}): MockEl {
  return { tag: 'view', data };
}

describe('US-406 L1 dataset read', () => {
  beforeAll(() => {
    installPapi();
  });

  it('reads existing data-* via property access', () => {
    const e = wrapPapi(el({ foo: 'bar', userId: '42' })) as L1ReadOnlyElement;
    expect(e.dataset['foo']).toBe('bar');
    expect(e.dataset['userId']).toBe('42');
  });

  it('returns undefined for absent key', () => {
    const e = wrapPapi(el({ foo: 'bar' })) as L1ReadOnlyElement;
    expect(e.dataset['missing']).toBeUndefined();
  });

  it('\'in\' operator reflects PAPI presence', () => {
    const e = wrapPapi(el({ foo: 'bar' })) as L1ReadOnlyElement;
    expect('foo' in e.dataset).toBe(true);
    expect('missing' in e.dataset).toBe(false);
  });

  it('Object.keys lists dataset keys', () => {
    const e = wrapPapi(
      el({ a: '1', b: '2', c: '3' }),
    ) as L1ReadOnlyElement;
    expect(Object.keys(e.dataset).sort()).toEqual(['a', 'b', 'c']);
  });

  it('coerces non-string PAPI values', () => {
    const e = wrapPapi(
      el({ count: 5, flag: true, obj: { nested: 'yes' } }),
    ) as L1ReadOnlyElement;
    expect(e.dataset['count']).toBe('5');
    expect(e.dataset['flag']).toBe('true');
    expect(e.dataset['obj']).toBe('{"nested":"yes"}');
  });

  it('treats null PAPI value as absent', () => {
    const e = wrapPapi(el({ nope: null })) as L1ReadOnlyElement;
    expect(e.dataset['nope']).toBeUndefined();
    expect('nope' in e.dataset).toBe(false);
  });

  it('writes throw', () => {
    const e = wrapPapi(el({ foo: 'bar' })) as L1ReadOnlyElement;
    const ds = e.dataset as Record<string, string>;
    expect(() => {
      ds['x'] = 'y';
    }).toThrow(/readonly/i);
  });

  it('deletes throw', () => {
    const e = wrapPapi(el({ foo: 'bar' })) as L1ReadOnlyElement;
    const ds = e.dataset as Record<string, string>;
    expect(() => {
      delete ds['foo'];
    }).toThrow(/readonly/i);
  });

  it('iteration enumerates keys', () => {
    const e = wrapPapi(el({ p: '1', q: '2' })) as L1ReadOnlyElement;
    const seen: string[] = [];
    for (const k of Object.keys(e.dataset)) seen.push(k);
    expect(seen.sort()).toEqual(['p', 'q']);
  });
});
