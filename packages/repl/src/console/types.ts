// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';
export type ConsoleSource = 'main-thread' | 'background';

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  source: ConsoleSource;
  args: string[];
  timestamp: number;
}

export interface ConsoleMessage {
  level: ConsoleLevel;
  source: ConsoleSource;
  args: string[];
  timestamp: number;
}
