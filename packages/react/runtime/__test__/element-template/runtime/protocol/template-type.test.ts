// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import {
  elementTemplateIdentityKey,
  parseElementTemplateType,
} from '../../../../src/element-template/protocol/template-type.js';

describe('element template type protocol', () => {
  it('keeps local template ids unchanged', () => {
    expect(parseElementTemplateType('_et_a')).toEqual({
      templateKey: '_et_a',
      bundleUrl: null,
    });
  });

  it('splits dynamic bundle entry from local template id at the final delimiter', () => {
    expect(parseElementTemplateType('https://example.com/main.lynx.bundle:_et_a')).toEqual({
      templateKey: '_et_a',
      bundleUrl: 'https://example.com/main.lynx.bundle',
    });
  });

  it('rebuilds the runtime identity key from serialized native fields', () => {
    expect(elementTemplateIdentityKey('_et_a', 'https://example.com/main.lynx.bundle')).toBe(
      'https://example.com/main.lynx.bundle:_et_a',
    );
  });

  it('keeps an empty bundle url distinct from a page-local template', () => {
    expect(parseElementTemplateType(':_et_a')).toEqual({
      templateKey: '_et_a',
      bundleUrl: '',
    });
    expect(elementTemplateIdentityKey('_et_a', '')).toBe(':_et_a');
    expect(elementTemplateIdentityKey('_et_a', null)).toBe('_et_a');
  });
});
