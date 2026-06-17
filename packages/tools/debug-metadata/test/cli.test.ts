// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { parseHeader, parseRemapArgs } from '../src/cli.js';

describe('parseHeader', () => {
  test('splits "name: value" on the first colon', () => {
    expect(parseHeader('internal-token: abc')).toEqual([
      'internal-token',
      'abc',
    ]);
  });

  test('preserves colons inside the value', () => {
    expect(parseHeader('referer: https://example.com:8443/path')).toEqual([
      'referer',
      'https://example.com:8443/path',
    ]);
  });

  test('trims surrounding whitespace from name and value', () => {
    expect(parseHeader('  Authorization  :   Bearer abc  ')).toEqual([
      'Authorization',
      'Bearer abc',
    ]);
  });

  test('rejects values without a colon', () => {
    expect(() => parseHeader('no-colon')).toThrow(/expected "name: value"/);
  });

  test('rejects empty header name', () => {
    expect(() => parseHeader(': value')).toThrow(/empty name/);
  });

  test('accepts empty value', () => {
    expect(parseHeader('x-empty:')).toEqual(['x-empty', '']);
  });
});

describe('parseRemapArgs', () => {
  test('parses --ui and --output', () => {
    const args = parseRemapArgs(['--ui', 'in.json', '--output', 'out.json']);
    expect(args.ui).toBe('in.json');
    expect(args.output).toBe('out.json');
    expect(args.headers).toEqual({});
  });

  test('accepts -i and -o short flags', () => {
    const args = parseRemapArgs(['-i', 'in.json', '-o', 'out.json']);
    expect(args.ui).toBe('in.json');
    expect(args.output).toBe('out.json');
  });

  test('collects repeated --header values', () => {
    const args = parseRemapArgs([
      '--ui',
      'in.json',
      '--header',
      'internal-token: abc',
      '--header',
      'authorization: Bearer xyz',
    ]);
    expect(args.headers).toEqual({
      'internal-token': 'abc',
      'authorization': 'Bearer xyz',
    });
  });

  test('accepts -H short flag for headers', () => {
    const args = parseRemapArgs([
      '-i',
      'in.json',
      '-H',
      'internal-token: abc',
      '-H',
      'accept: application/json',
    ]);
    expect(args.headers).toEqual({
      'internal-token': 'abc',
      'accept': 'application/json',
    });
  });

  test('later --header for the same name wins', () => {
    const args = parseRemapArgs([
      '-i',
      'in.json',
      '-H',
      'internal-token: old',
      '-H',
      'internal-token: new',
    ]);
    expect(args.headers).toEqual({ 'internal-token': 'new' });
  });

  test('rejects unknown arguments', () => {
    expect(() => parseRemapArgs(['--mystery', 'x'])).toThrow(
      /Unknown argument/,
    );
  });

  test('rejects --header without a value', () => {
    expect(() => parseRemapArgs(['--ui', 'in.json', '--header'])).toThrow(
      /Missing value/,
    );
  });

  test('rejects malformed --header value', () => {
    expect(() => parseRemapArgs(['--ui', 'in.json', '--header', 'no-colon']))
      .toThrow(/expected "name: value"/);
  });
});
