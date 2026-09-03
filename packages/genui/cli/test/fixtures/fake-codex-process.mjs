#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

if (process.argv.includes('login')) {
  console.info('logged in');
} else {
  process.on('SIGTERM', () => {
    // Deliberately ignore TERM so the adapter exercises its SIGKILL fallback.
  });
  const child = spawn(process.execPath, [
    '-e',
    'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)',
  ]);
  fs.writeFileSync(process.env['CHILD_PID_FILE'], String(child.pid));
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
    for (;;) {
      const end = input.indexOf('\n');
      if (end < 0) break;
      const line = input.slice(0, end);
      input = input.slice(end + 1);
      const message = JSON.parse(line);
      const stopBeforeTurn = process.env['STOP_BEFORE_TURN_ID'] === '1';
      if (message.method === 'turn/start' && stopBeforeTurn) {
        // Arm cancellation before publishing the observed request. The test
        // process may otherwise see the log file before this handler exists.
        process.once('SIGTERM', () => {
          process.removeAllListeners('SIGTERM');
          process.kill(process.pid, 'SIGTERM');
        });
      }
      fs.appendFileSync(
        process.env['PROTOCOL_LOG'],
        JSON.stringify(message) + '\n',
      );
      if (
        message.method === 'turn/interrupt'
        && process.env['PARENT_EXITS_ON_INTERRUPT'] === '1'
      ) {
        setImmediate(() => {
          process.removeAllListeners('SIGTERM');
          process.kill(process.pid, 'SIGTERM');
        });
      }
      if (message.id === 1) console.info(JSON.stringify({ id: 1, result: {} }));
      if (message.id === 2) {
        console.info(JSON.stringify({
          id: 2,
          result: { thread: { id: 'thread' } },
        }));
      }
      if (message.id === 3) {
        if (stopBeforeTurn) continue;
        console.info(JSON.stringify({
          id: 3,
          result: { turn: { id: 'turn' } },
        }));
        if (process.env['EMIT_TURN_READY_DELTA'] === '1') {
          console.info(JSON.stringify({
            method: 'item/agentMessage/delta',
            params: { delta: 'turn-ready' },
          }));
        }
      }
    }
  });
  setInterval(() => {
    // Keep the fixture alive until the adapter kills its process group.
  }, 1_000);
}
