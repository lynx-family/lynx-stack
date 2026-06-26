// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { resolveConversationProtocol } from './conversationRepo.js';

describe('conversation protocol metadata', () => {
  test('treats legacy conversations without protocol as A2UI', () => {
    expect(resolveConversationProtocol({})).toBe('a2ui');
  });

  test('keeps OpenUI conversations isolated by protocol metadata', () => {
    expect(resolveConversationProtocol({ protocol: 'openui' })).toBe('openui');
  });
});
