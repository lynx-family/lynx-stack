// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MessagePort } from 'node:worker_threads'

export interface Data {
  port: MessagePort
  options?: Options
}

export interface Options {
  load: boolean
  resolve: boolean
}
