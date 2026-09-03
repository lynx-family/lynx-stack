// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  ADAPTER_PROFILES,
  AsyncEventQueue,
  JsonMessageDecoder,
  createAgentAdapters,
  parseCodexModelPage,
  parseCursorModels,
  parseTraeModels,
  reduceProtocolFixture,
  reduceProtocolFixtureWithResponses,
} from '../src/playground/adapters.js';
import {
  AGENT_EVENT_QUEUE_BYTES_LIMIT,
  AGENT_EVENT_QUEUE_COUNT_LIMIT,
  PROTOCOL_FRAME_BYTES_LIMIT,
} from '../src/playground/types.js';
import type { AgentEvent } from '../src/playground/types.js';

describe('local agent adapters', () => {
  test('bounds only events that are actually waiting for consumption', async () => {
    const queue = new AsyncEventQueue();
    const iterator = queue[Symbol.asyncIterator]();
    for (let index = 0; index < AGENT_EVENT_QUEUE_COUNT_LIMIT * 2; index++) {
      queue.push({ type: 'activity', text: String(index) });
      expect(await nextQueuedEvent(iterator)).toEqual({
        type: 'activity',
        text: String(index),
      });
    }
  });

  test('fails closed with observed counts when the consumer is stalled', async () => {
    const queue = new AsyncEventQueue();
    for (let index = 0; index <= AGENT_EVENT_QUEUE_COUNT_LIMIT; index++) {
      queue.push({ type: 'activity', text: String(index) });
    }
    const event = await nextQueuedEvent(queue[Symbol.asyncIterator]());
    expect(event.type).toBe('error');
    if (event.type !== 'error') throw new Error('Expected queue overflow');
    expect(event.message).toMatch(
      new RegExp(
        `${
          AGENT_EVENT_QUEUE_COUNT_LIMIT + 1
        } events.*${AGENT_EVENT_QUEUE_COUNT_LIMIT} events`,
        'iu',
      ),
    );
  });

  test('reports actual bytes when the pending Agent queue overflows', async () => {
    const queue = new AsyncEventQueue();
    const text = 'x'.repeat(1024 * 1024);
    for (let index = 0; index < 17; index++) {
      queue.push({ type: 'assistant_delta', text });
    }
    const event = await nextQueuedEvent(queue[Symbol.asyncIterator]());
    expect(event.type).toBe('error');
    if (event.type !== 'error') throw new Error('Expected queue overflow');
    expect(event.message).toMatch(
      new RegExp(
        `${AGENT_EVENT_QUEUE_BYTES_LIMIT} bytes`,
        'u',
      ),
    );
  });

  test('exposes exactly four safe built-in profiles', () => {
    expect(ADAPTER_PROFILES.map(({ id, command }) => [id, command])).toEqual([
      ['codex', ['codex', 'app-server', '--stdio']],
      ['claude', [
        'claude',
        '-p',
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
        '--verbose',
      ]],
      ['cursor', ['cursor-agent', 'acp']],
      ['trae', ['traecli', 'acp', 'serve']],
    ]);
    expect(JSON.stringify(ADAPTER_PROFILES)).not.toMatch(
      /yolo|bypass|dangerously|force/iu,
    );
  });

  test('parses Codex, Cursor, and Trae model catalogs without guessing values', () => {
    expect(parseCodexModelPage({
      data: [{
        model: 'codex-model',
        displayName: 'Codex Model',
        supportedReasoningEfforts: [
          { reasoningEffort: 'low' },
          { reasoningEffort: 'high' },
          { reasoningEffort: 'low' },
        ],
      }, { model: 'hidden', hidden: true }],
      nextCursor: 'page-2',
    })).toEqual({
      models: [{
        value: 'codex-model',
        label: 'Codex Model',
        efforts: ['low', 'high'],
      }],
      nextCursor: 'page-2',
    });
    expect(parseCursorModels(
      'Available models\n\ncomposer-1 - Composer 1\nauto - Auto\ninvalid',
    )).toEqual([
      { value: 'composer-1', label: 'Composer 1' },
      { value: 'auto', label: 'Auto' },
    ]);
    expect(parseTraeModels({
      models: [
        { config_name: 'trae-config', name: 'Trae Display' },
        { name: 'name-fallback' },
        { config_name: 'trae-config', name: 'Duplicate' },
      ],
    })).toEqual([
      { value: 'trae-config', label: 'Trae Display' },
      { value: 'name-fallback', label: 'name-fallback' },
    ]);
  });

  test('discovers Codex pages and deduplicates concurrent cached requests', async () => {
    const root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-model-codex-'),
    );
    const fixture = path.resolve('test/fixtures/fake-model-agent.mjs');
    const executable = path.join(root, 'codex');
    const countFile = path.join(root, 'count.log');
    fs.copyFileSync(fixture, executable);
    fs.chmodSync(executable, 0o700);
    try {
      const adapter = createAgentAdapters(process.cwd(), {
        ...process.env,
        PATH: root + path.delimiter + path.dirname(process.execPath),
        MODEL_PROBE_COUNT_FILE: countFile,
      }).get('codex')!;
      const [first, concurrent] = await Promise.all([
        adapter.listModels(),
        adapter.listModels(),
      ]);
      expect(first).toEqual(concurrent);
      expect(first).toEqual({
        status: 'ready',
        models: [{
          value: 'fixture-codex-1',
          label: 'Fixture Codex 1',
          efforts: ['low', 'medium'],
        }, {
          value: 'fixture-codex-2',
          label: 'Fixture Codex 2',
          efforts: ['high'],
        }],
      });
      await adapter.listModels();
      expect(fs.readFileSync(countFile, 'utf8').trim().split('\n'))
        .toEqual(['codex:model/list', 'codex:model/list']);
      await adapter.listModels(true);
      expect(fs.readFileSync(countFile, 'utf8').trim().split('\n'))
        .toHaveLength(4);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('discovers Cursor and Trae models asynchronously and keeps Claude default-only', async () => {
    const root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-model-cli-'),
    );
    const fixture = path.resolve('test/fixtures/fake-model-agent.mjs');
    for (const command of ['cursor-agent', 'traecli', 'claude']) {
      const executable = path.join(root, command);
      fs.copyFileSync(fixture, executable);
      fs.chmodSync(executable, 0o700);
    }
    try {
      const adapters = createAgentAdapters(process.cwd(), {
        ...process.env,
        PATH: root + path.delimiter + path.dirname(process.execPath),
      });
      expect(await adapters.get('cursor')!.listModels()).toEqual({
        status: 'ready',
        models: [
          { value: 'fixture-cursor', label: 'Fixture Cursor' },
          { value: 'auto', label: 'Auto' },
        ],
      });
      expect(await adapters.get('trae')!.listModels()).toEqual({
        status: 'ready',
        models: [
          { value: 'fixture-trae', label: 'Fixture Trae' },
          { value: 'Name fallback', label: 'Name fallback' },
        ],
      });
      expect(adapters.get('claude')!.descriptor.capabilities.models).toBe(
        false,
      );
      expect(await adapters.get('claude')!.listModels()).toEqual({
        status: 'unsupported',
        reason: 'agent-does-not-expose-model-list',
        models: [],
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('applies Cursor and Trae model choices at the native argv boundary', async () => {
    const root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-model-argv-'),
    );
    const fixture = path.resolve('test/fixtures/fake-model-agent.mjs');
    const capture = path.join(root, 'argv.jsonl');
    for (const command of ['cursor-agent', 'traecli']) {
      const executable = path.join(root, command);
      fs.copyFileSync(fixture, executable);
      fs.chmodSync(executable, 0o700);
    }
    try {
      const adapters = createAgentAdapters(process.cwd(), {
        ...process.env,
        PATH: root + path.delimiter + path.dirname(process.execPath),
        MODEL_LAUNCH_CAPTURE_FILE: capture,
      });
      for (
        const [agentId, model] of [
          ['cursor', 'fixture-cursor'],
          ['trae', 'fixture-trae'],
        ] as const
      ) {
        const running = adapters.get(agentId)!.launch({
          systemPrompt: 'system',
          prompt: 'prompt',
          cwd: process.cwd(),
          model,
        });
        for await (const _event of running.events) {
          // Drain the deterministic protocol fixture.
        }
        await running.close();
      }
      const launches = fs.readFileSync(capture, 'utf8').trim().split('\n')
        .map((line) => JSON.parse(line) as { agent: string; args: string[] });
      expect(launches).toEqual([{
        agent: 'cursor-agent',
        args: ['--model', 'fixture-cursor', 'acp'],
      }, {
        agent: 'traecli',
        args: ['-m', 'fixture-trae', 'acp', 'serve'],
      }]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('fails closed on model probe output overflow', async () => {
    const root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-model-overflow-'),
    );
    const fixture = path.resolve('test/fixtures/fake-model-agent.mjs');
    const executable = path.join(root, 'cursor-agent');
    fs.copyFileSync(fixture, executable);
    fs.chmodSync(executable, 0o700);
    try {
      const adapter = createAgentAdapters(process.cwd(), {
        ...process.env,
        PATH: root + path.delimiter + path.dirname(process.execPath),
        MODEL_PROBE_MODE: 'overflow',
      }).get('cursor')!;
      await expect(adapter.listModels()).rejects.toThrow(/exceeded 1 MiB/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('cleans the detached process group after successful model discovery', async () => {
    const root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-model-cleanup-'),
    );
    const fixture = path.resolve('test/fixtures/fake-model-agent.mjs');
    const executable = path.join(root, 'cursor-agent');
    const childPidFile = path.join(root, 'child.pid');
    fs.copyFileSync(fixture, executable);
    fs.chmodSync(executable, 0o700);
    try {
      const adapter = createAgentAdapters(process.cwd(), {
        ...process.env,
        PATH: root + path.delimiter + path.dirname(process.execPath),
        MODEL_PROBE_MODE: 'success-with-child',
        MODEL_PROBE_CHILD_PID_FILE: childPidFile,
      }).get('cursor')!;
      await expect(adapter.listModels()).resolves.toMatchObject({
        status: 'ready',
      });
      const childPid = Number(fs.readFileSync(childPidFile, 'utf8'));
      expect(processExists(childPid)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test(
    'times out model discovery and cleans its detached process group',
    async () => {
      const root = fs.mkdtempSync(
        path.join(fs.realpathSync(os.tmpdir()), 'genui-model-timeout-'),
      );
      const fixture = path.resolve('test/fixtures/fake-model-agent.mjs');
      const executable = path.join(root, 'cursor-agent');
      const childPidFile = path.join(root, 'child.pid');
      fs.copyFileSync(fixture, executable);
      fs.chmodSync(executable, 0o700);
      try {
        const adapter = createAgentAdapters(process.cwd(), {
          ...process.env,
          PATH: root + path.delimiter + path.dirname(process.execPath),
          MODEL_PROBE_MODE: 'hang',
          MODEL_PROBE_CHILD_PID_FILE: childPidFile,
        }).get('cursor')!;
        const discovery = adapter.listModels();
        await until(() => fs.existsSync(childPidFile));
        const childPid = Number(fs.readFileSync(childPidFile, 'utf8'));
        await expect(discovery).rejects.toThrow(/timed out/);
        expect(processExists(childPid)).toBe(false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
    15_000,
  );

  test('decodes split, duplicate, and malformed JSON protocol frames safely', () => {
    const decoder = new JsonMessageDecoder();
    expect(decoder.push('{"type":"result",')).toEqual([]);
    expect(decoder.push('"result":"ok"}\nnot-json\n')).toEqual([
      { type: 'result', result: 'ok' },
      { __malformed: 'not-json' },
    ]);
  });

  test('keeps the single protocol frame limit independent from queue limits', () => {
    const decoder = new JsonMessageDecoder();
    expect(() => decoder.push('x'.repeat(PROTOCOL_FRAME_BYTES_LIMIT + 1)))
      .toThrow(new RegExp(String(PROTOCOL_FRAME_BYTES_LIMIT), 'u'));
  });

  test('does not combine multiple valid protocol frames into one byte limit', () => {
    const decoder = new JsonMessageDecoder();
    const text = 'x'.repeat(PROTOCOL_FRAME_BYTES_LIMIT / 2);
    expect(decoder.push(
      `${JSON.stringify({ text })}\n${JSON.stringify({ text })}\n`,
    )).toHaveLength(2);
  });

  test('ignores out-of-order sequenced protocol events', () => {
    const events = reduceProtocolFixture('claude', [
      {
        sequence: 2,
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { text: 'new' } },
      },
      {
        sequence: 1,
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { text: 'stale' } },
      },
      { sequence: 3, type: 'result', result: 'final' },
    ]);
    expect(events).toEqual([
      { type: 'assistant_delta', text: 'new' },
      { type: 'assistant_final', text: 'final' },
    ]);
  });

  test('uses final Claude result as authority and ignores late or duplicate events', () => {
    const events = reduceProtocolFixture('claude', [
      {
        eventId: '1',
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { text: 'partial' } },
      },
      {
        eventId: '1',
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { text: 'duplicate' } },
      },
      { eventId: '2', type: 'result', result: 'final' },
      {
        eventId: '3',
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'late' }] },
      },
    ]);
    expect(events).toEqual([
      { type: 'assistant_delta', text: 'partial' },
      { type: 'assistant_final', text: 'final' },
    ]);
  });

  test('normalizes ACP tool, thought, final, and post-terminal events', () => {
    const events = reduceProtocolFixture('cursor', [
      {
        method: 'session/update',
        params: {
          update: {
            sessionUpdate: 'agent_thought_chunk',
            content: { text: 'secret' },
          },
        },
      },
      {
        method: 'session/update',
        params: {
          update: {
            sessionUpdate: 'tool_call',
            title: 'read_file',
            status: 'pending',
          },
        },
      },
      {
        method: 'session/update',
        params: {
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'answer' },
          },
        },
      },
      { id: 3, result: { stopReason: 'end_turn' } },
      {
        method: 'session/update',
        params: {
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'late' },
          },
        },
      },
    ]);
    expect(events.map((event) => event.type)).toEqual([
      'activity',
      'tool',
      'assistant_delta',
      'assistant_final',
    ]);
    expect(events.at(-1)).toEqual({ type: 'assistant_final', text: 'answer' });
  });

  test('recognizes ACP idle/cancelled as protocol cancellation evidence', () => {
    expect(reduceProtocolFixture('trae', [{
      method: 'session/update',
      params: {
        update: { sessionUpdate: 'idle', stopReason: 'cancelled' },
      },
    }])).toEqual([{
      type: 'activity',
      text: 'Agent acknowledged cancellation',
    }]);
  });

  test('fails closed on protocol errors and oversized output', () => {
    expect(reduceProtocolFixture('codex', [
      { id: 1, error: { message: 'not initialized' } },
      { method: 'item/agentMessage/delta', params: { delta: 'late' } },
    ])).toEqual([{ type: 'error', message: 'not initialized' }]);
    expect(reduceProtocolFixture('cursor', [{
      method: 'session/update',
      params: {
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'x'.repeat(2 * 1024 * 1024 + 1) },
        },
      },
    }])).toEqual([{
      type: 'error',
      message: 'Agent output exceeds the 2 MiB artifact limit',
    }]);
  });

  test('fails before prompt when required cancellation is not negotiated', () => {
    expect(reduceProtocolFixture('cursor', [{
      jsonrpc: '2.0',
      id: 1,
      result: { agentCapabilities: { cancellation: false } },
    }, {
      method: 'session/update',
      params: {
        update: { sessionUpdate: 'agent_message_chunk', text: 'late' },
      },
    }])).toEqual([{
      type: 'error',
      message:
        'Cursor Agent protocol negotiation disabled required cancellation capability',
    }]);
  });

  test('keeps approval denials non-terminal for later final output', () => {
    const events = reduceProtocolFixture('codex', [
      { id: 45, error: { message: 'request denied' } },
      {
        method: 'item/agentMessage/delta',
        params: { delta: 'answer' },
      },
      { method: 'turn/completed', params: { turn: { status: 'completed' } } },
    ]);
    expect(events).toEqual([
      { type: 'assistant_delta', text: 'answer' },
      { type: 'assistant_final', text: 'answer' },
    ]);
  });

  test('deduplicates native JSON-RPC approval ids and fails once on conflicting reuse', () => {
    const duplicate = {
      jsonrpc: '2.0',
      id: 45,
      method: 'session/request_permission',
      params: { title: 'Run pwd' },
    };
    const exactDuplicate = reduceProtocolFixture('cursor', [
      duplicate,
      { ...duplicate, params: { title: 'Run pwd' } },
    ]);
    expect(exactDuplicate).toHaveLength(1);
    expect(exactDuplicate[0]).toMatchObject({
      type: 'approval',
      requestId: 'number:45',
      prompt: 'Run pwd',
    });

    const conflict = reduceProtocolFixture('cursor', [
      duplicate,
      { ...duplicate, params: { title: 'Run something else' } },
      { ...duplicate, id: 46 },
    ]);
    expect(conflict.map((event) => event.type)).toEqual([
      'approval',
      'error',
    ]);
    expect(conflict[1]).toEqual({
      type: 'error',
      message: 'Conflicting JSON-RPC request id reuse: number:45',
    });
  });

  test('requires an advertised ACP allow-once option and sends transport cancellation', () => {
    const withoutAllow = reduceProtocolFixtureWithResponses('cursor', [{
      jsonrpc: '2.0',
      id: 45,
      method: 'session/request_permission',
      params: {
        title: 'Run pwd',
        options: [{ optionId: 'deny-token', kind: 'reject_once' }],
      },
    }]);
    const missingAllow = withoutAllow.events[0];
    expect(missingAllow).toMatchObject({
      type: 'approval',
      decisions: ['deny'],
    });
    expect(() => {
      if (missingAllow?.type === 'approval') missingAllow.respond('allow_once');
    }).toThrow(/did not offer an allow-once option/);
    if (missingAllow?.type === 'approval') missingAllow.cancel();
    expect(withoutAllow.responses).toEqual([{
      jsonrpc: '2.0',
      id: 45,
      result: { outcome: { outcome: 'cancelled' } },
    }]);

    const withAllow = reduceProtocolFixtureWithResponses('cursor', [{
      jsonrpc: '2.0',
      id: 46,
      method: 'session/request_permission',
      params: {
        title: 'Run pwd',
        options: [{ optionId: 'allow-token', kind: 'allow_once' }],
      },
    }]);
    const offered = withAllow.events[0];
    if (offered?.type === 'approval') offered.respond('allow_once');
    expect(withAllow.responses).toEqual([{
      jsonrpc: '2.0',
      id: 46,
      result: {
        outcome: { outcome: 'selected', optionId: 'allow-token' },
      },
    }]);
  });

  test('fails closed at request-ID capacity without evicting prior identities', () => {
    const requests = Array.from({ length: 2_048 }, (_, id) => ({
      jsonrpc: '2.0',
      id,
      method: 'session/request_permission',
      params: { title: `Request ${id}` },
    }));
    const oldestReplay = structuredClone(requests[0]!);
    const overflow = {
      jsonrpc: '2.0',
      id: 2_048,
      method: 'session/request_permission',
      params: { title: 'Overflow' },
    };
    const later = {
      jsonrpc: '2.0',
      id: 2_049,
      method: 'session/request_permission',
      params: { title: 'Must not be accepted' },
    };
    const events = reduceProtocolFixture('cursor', [
      ...requests,
      oldestReplay,
      overflow,
      later,
    ]);
    const approvals = events.filter((event) => event.type === 'approval');
    const errors = events.filter((event) => event.type === 'error');
    expect(approvals).toHaveLength(2_048);
    expect(
      approvals.filter((event) =>
        event.type === 'approval' && event.requestId === 'number:0'
      ),
    ).toHaveLength(1);
    expect(errors).toEqual([{
      type: 'error',
      message: 'JSON-RPC request ID capacity exceeded (2048)',
    }]);
    expect(events.at(-1)).toEqual(errors[0]);
  });

  test('extracts bounded usage and policy-blocked summaries', () => {
    expect(reduceProtocolFixture('claude', [{
      type: 'result',
      result: 'final',
      usage: { input_tokens: 12, output_tokens: 7 },
    }])).toEqual([
      { type: 'usage', inputTokens: 12, outputTokens: 7 },
      { type: 'assistant_final', text: 'final' },
    ]);
    expect(
      reduceProtocolFixture('codex', [{
        method: 'turn/failed',
        params: { message: 'blocked by policy token=private' },
      }]).map((event) => event.type),
    ).toEqual(['policy_blocked', 'error']);
  });

  test(
    'uses native cancellation before killing the detached process group',
    async () => {
      const root = fs.mkdtempSync(
        path.join(fs.realpathSync(os.tmpdir()), 'genui-adapter-kill-'),
      );
      const executable = path.join(root, 'codex');
      const fixture = path.resolve('test/fixtures/fake-codex-process.mjs');
      const childPidFile = path.join(root, 'child.pid');
      const protocolLog = path.join(root, 'protocol.log');
      fs.symlinkSync(fixture, executable);
      try {
        const adapter = createAgentAdapters(process.cwd(), {
          ...process.env,
          PATH: root + path.delimiter + path.dirname(process.execPath),
          CHILD_PID_FILE: childPidFile,
          EMIT_TURN_READY_DELTA: '1',
          PARENT_EXITS_ON_INTERRUPT: '1',
          PROTOCOL_LOG: protocolLog,
        }).get('codex')!;
        const running = adapter.launch({
          systemPrompt: 'test',
          prompt: 'test',
          cwd: process.cwd(),
          model: 'fixture-codex',
          effort: 'high',
        });
        await until(() => fs.existsSync(childPidFile));
        await until(() =>
          fs.existsSync(protocolLog)
          && fs.readFileSync(protocolLog, 'utf8').includes('turn/start')
        );
        const ready = await running.events[Symbol.asyncIterator]().next();
        expect(ready).toMatchObject({
          done: false,
          value: { type: 'assistant_delta', text: 'turn-ready' },
        });
        running.cancel();
        await running.close();
        const childPid = Number(fs.readFileSync(childPidFile, 'utf8'));
        const protocol = fs.readFileSync(protocolLog, 'utf8');
        expect(protocol).toContain(
          '"method":"turn/interrupt"',
        );
        const requests = protocol.trim().split('\n').map((line) =>
          JSON.parse(line) as {
            method?: string;
            params?: { model?: string; effort?: string };
          }
        );
        for (const method of ['thread/start', 'turn/start']) {
          expect(requests.find((request) => request.method === method)?.params)
            .toMatchObject({ model: 'fixture-codex', effort: 'high' });
        }
        expect(processExists(running.processId!)).toBe(false);
        expect(processExists(childPid)).toBe(false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
    10_000,
  );

  test(
    'does not send an invalid Codex interrupt before the native turn id exists',
    async () => {
      const root = fs.mkdtempSync(
        path.join(fs.realpathSync(os.tmpdir()), 'genui-codex-partial-'),
      );
      const executable = path.join(root, 'codex');
      const fixture = path.resolve('test/fixtures/fake-codex-process.mjs');
      const childPidFile = path.join(root, 'child.pid');
      const protocolLog = path.join(root, 'protocol.log');
      fs.symlinkSync(fixture, executable);
      try {
        const adapter = createAgentAdapters(process.cwd(), {
          ...process.env,
          PATH: root + path.delimiter + path.dirname(process.execPath),
          CHILD_PID_FILE: childPidFile,
          PROTOCOL_LOG: protocolLog,
          STOP_BEFORE_TURN_ID: '1',
        }).get('codex')!;
        const running = adapter.launch({
          systemPrompt: 'test',
          prompt: 'test',
          cwd: process.cwd(),
        });
        await until(() =>
          fs.existsSync(protocolLog)
          && fs.readFileSync(protocolLog, 'utf8').includes(
            '"method":"turn/start"',
          )
        );
        const startedAt = performance.now();
        running.cancel();
        await running.close();
        expect(performance.now() - startedAt).toBeLessThan(450);
        expect(fs.readFileSync(protocolLog, 'utf8')).not.toContain(
          '"method":"turn/interrupt"',
        );
        expect(processExists(running.processId!)).toBe(false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
    10_000,
  );

  test('injects the Claude system prompt exactly once at the launch boundary', async () => {
    const root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-claude-argv-'),
    );
    const executable = path.join(root, 'claude');
    const fixture = path.resolve('test/fixtures/fake-claude-process.mjs');
    const capture = path.join(root, 'capture.json');
    fs.symlinkSync(fixture, executable);
    fs.chmodSync(fixture, 0o700);
    try {
      const adapter = createAgentAdapters(process.cwd(), {
        ...process.env,
        PATH: root + path.delimiter + path.dirname(process.execPath),
        CLAUDE_CAPTURE_FILE: capture,
      }).get('claude')!;
      const systemPrompt = '<system>complete Lynx XML contract</system>';
      const userPrompt = 'Create one harmless view';
      const running = adapter.launch({
        systemPrompt,
        prompt: userPrompt,
        cwd: process.cwd(),
        model: 'must-not-be-forwarded',
      });
      const events = [];
      for await (const event of running.events) events.push(event);
      await running.close();
      const recorded = JSON.parse(fs.readFileSync(capture, 'utf8')) as {
        argv: string[];
        stdin: string;
      };
      expect(
        recorded.argv.filter((value) => value === '--append-system-prompt'),
      ).toHaveLength(1);
      const flag = recorded.argv.indexOf('--append-system-prompt');
      expect(recorded.argv[flag + 1]).toBe(systemPrompt);
      expect(recorded.argv).toContain('--include-partial-messages');
      expect(recorded.argv).not.toContain('--model');
      expect(recorded.argv).not.toContain('must-not-be-forwarded');
      expect(recorded.argv.filter((value) => value === systemPrompt))
        .toHaveLength(1);
      expect(recorded.stdin).not.toContain(systemPrompt);
      expect(recorded.stdin.match(new RegExp(userPrompt, 'gu'))).toHaveLength(
        1,
      );
      expect(events.some((event) => event.type === 'assistant_final')).toBe(
        true,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

async function nextQueuedEvent(
  iterator: AsyncIterator<AgentEvent>,
): Promise<AgentEvent> {
  const result = await iterator.next();
  if (result.done) throw new Error('Agent event queue ended unexpectedly');
  return result.value;
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

async function until(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 200; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out');
}
