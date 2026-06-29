// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { resolveSharedConversationProtocol } from './sharedConversation.js';

describe('shared conversation protocol metadata', () => {
  test('treats legacy shared conversations without protocol as A2UI', () => {
    expect(resolveSharedConversationProtocol({})).toBe('a2ui');
  });

  test('keeps OpenUI shared conversations explicit', () => {
    expect(resolveSharedConversationProtocol({ protocol: 'openui' })).toBe(
      'openui',
    );
  });

  test('rejects unknown shared conversation protocols', () => {
    expect(resolveSharedConversationProtocol({ protocol: 'unknown' })).toBe(
      null,
    );
  });
});
