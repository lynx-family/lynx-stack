#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const agent = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const countFile = process.env['MODEL_PROBE_COUNT_FILE'];
const captureFile = process.env['MODEL_LAUNCH_CAPTURE_FILE'];

if (
  args.includes('status') || args.includes('auth') || args.includes('login')
) {
  console.info('authenticated');
  // eslint-disable-next-line n/no-process-exit -- The fixture emulates a CLI probe that exits immediately.
  process.exit(0);
}

if (args.includes('--list-models') || args.includes('models')) {
  if (countFile) fs.appendFileSync(countFile, `${agent}\n`);
  if (process.env['MODEL_PROBE_MODE'] === 'success-with-child') {
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
      stdio: 'ignore',
    });
    if (process.env['MODEL_PROBE_CHILD_PID_FILE']) {
      fs.writeFileSync(
        process.env['MODEL_PROBE_CHILD_PID_FILE'],
        String(child.pid),
      );
    }
  }
  if (process.env['MODEL_PROBE_MODE'] === 'overflow') {
    fs.writeSync(1, 'x'.repeat(1024 * 1024 + 1));
  } else if (process.env['MODEL_PROBE_MODE'] === 'hang') {
    const child = spawn(process.execPath, [
      '-e',
      'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)',
    ]);
    if (process.env['MODEL_PROBE_CHILD_PID_FILE']) {
      fs.writeFileSync(
        process.env['MODEL_PROBE_CHILD_PID_FILE'],
        String(child.pid),
      );
    }
    process.on('SIGTERM', () => undefined);
    setInterval(() => undefined, 1_000);
  } else if (agent === 'cursor-agent') {
    console.info(
      'Available models\n\nfixture-cursor - Fixture Cursor\nauto - Auto',
    );
  } else {
    console.info(JSON.stringify({
      models: [
        { name: 'Fixture Trae', config_name: 'fixture-trae' },
        { name: 'Name fallback' },
      ],
    }));
  }
  if (process.env['MODEL_PROBE_MODE'] !== 'hang') {
    // eslint-disable-next-line n/no-process-exit -- The fixture emulates a completed model-list command.
    process.exit(0);
  }
}

if (captureFile) {
  fs.appendFileSync(captureFile, JSON.stringify({ agent, args }) + '\n');
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  for (;;) {
    const newline = input.indexOf('\n');
    if (newline < 0) break;
    const line = input.slice(0, newline);
    input = input.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (agent === 'codex') {
      if (message.id === 1) {
        console.info(JSON.stringify({ id: 1, result: {} }));
      } else if (message.method === 'model/list') {
        if (countFile) fs.appendFileSync(countFile, 'codex:model/list\n');
        const secondPage = message.params?.cursor === 'next-page';
        console.info(JSON.stringify({
          id: message.id,
          result: {
            data: secondPage
              ? [{
                model: 'fixture-codex-2',
                displayName: 'Fixture Codex 2',
                hidden: false,
                supportedReasoningEfforts: [{ reasoningEffort: 'high' }],
              }]
              : [{
                model: 'fixture-codex-1',
                displayName: 'Fixture Codex 1',
                hidden: false,
                supportedReasoningEfforts: [
                  { reasoningEffort: 'low' },
                  { reasoningEffort: 'medium' },
                ],
              }, {
                model: 'hidden-model',
                displayName: 'Hidden',
                hidden: true,
              }],
            nextCursor: secondPage ? null : 'next-page',
          },
        }));
      }
      continue;
    }
    if (message.id === 1) {
      console.info(JSON.stringify({
        id: 1,
        result: {
          agentCapabilities: {
            tools: true,
            permissions: true,
            cancellation: true,
          },
        },
      }));
    } else if (message.id === 2) {
      console.info(JSON.stringify({ id: 2, result: { sessionId: 'session' } }));
    } else if (message.id === 3) {
      console.info(JSON.stringify({
        method: 'session/update',
        params: {
          update: {
            sessionUpdate: 'agent_message_chunk',
            text: '<!doctype lynx><lynx><script thread="main"></script></lynx>',
          },
        },
      }));
      console.info(
        JSON.stringify({ id: 3, result: { stopReason: 'end_turn' } }),
      );
    }
  }
});

setInterval(() => undefined, 1_000);
