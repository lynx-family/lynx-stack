// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function isOfficialOpenAIBaseURL(baseURL: string): boolean {
  try {
    return new URL(baseURL).hostname === 'api.openai.com';
  } catch {
    return false;
  }
}
