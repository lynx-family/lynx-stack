#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';

if (process.argv.includes('auth')) {
  console.info('authenticated');
} else {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => stdin += chunk);
  process.stdin.on('end', () => {
    fs.writeFileSync(
      process.env['CLAUDE_CAPTURE_FILE'],
      JSON.stringify({ argv: process.argv.slice(2), stdin }),
    );
    console.info(JSON.stringify({
      type: 'result',
      result: '<!doctype lynx><lynx><script thread="main"></script></lynx>',
    }));
  });
}
