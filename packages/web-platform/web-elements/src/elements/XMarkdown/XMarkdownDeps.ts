/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

// Keep runtime interop consistent with dynamic import usage in XMarkdownAttributes.
import * as mdModule from 'markdown-it';
import * as dpModule from 'dompurify';

export const MarkdownIt =
  ((mdModule as unknown as { default?: unknown }).default ?? mdModule) as any;

export const createDOMPurify =
  ((dpModule as unknown as { default?: unknown }).default ?? dpModule) as any;
