// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import { parseURL } from '../../client/parseURL.js';

describe('parseURL', () => {
  it('should parse correct url', () => {
    expect(parseURL('?foo=bar')).toStrictEqual({ foo: 'bar' });
    expect(parseURL('?foo')).toStrictEqual({ foo: true });
    expect(parseURL('?foo=bar&baz')).toStrictEqual({ foo: 'bar', baz: true });
    expect(parseURL('?foo&baz')).toStrictEqual({ foo: true, baz: true });
    expect(parseURL('?foo&baz=baz')).toStrictEqual({ foo: true, baz: 'baz' });
  });

  it('should parse encoded url', () => {
    expect(parseURL(
      `?foo=${encodeURIComponent('^%$#')}`,
    )).toStrictEqual({
      foo: '^%$#',
    });
  });

  it('should accept empty url', () => {
    expect(parseURL('')).toStrictEqual({});
  });

  it('should accept invalid query', () => {
    expect(parseURL('foo=bar')).toStrictEqual({});
    expect(parseURL('   foo=bar')).toStrictEqual({});
  });
});
