// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Buffer } from 'node:buffer';

export function getEncodeMode() {
  return (_options, enableTrace) => ({
    buffer: Buffer.alloc(0),
    error_msg: '',
    lepus_code: String(enableTrace),
    lepus_debug: '',
    section_size: '',
    status: 0,
    trace: '',
  });
}
