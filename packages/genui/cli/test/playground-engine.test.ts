// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { rstest } from '@rstest/core';

import {
  ASSISTANT_DELTA_BATCH_BYTES,
  ASSISTANT_DELTA_BATCH_MS,
  AssistantDeltaBatcher,
  PlaygroundEngine,
} from '../src/playground/engine.js';
import { PlaygroundStore } from '../src/playground/store.js';
import type {
  AgentAdapter,
  AgentEvent,
  AgentId,
} from '../src/playground/types.js';

const ARTIFACT =
  '<!doctype lynx>\n<lynx engine-version="4.2">\n<script thread="main">\nconst page = __CreatePage("0", 0);\n</script>\n</lynx>';

describe('PlaygroundEngine', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-engine-'),
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('flushes assistant deltas by byte size or elapsed time without changing text', () => {
    rstest.useFakeTimers();
    try {
      const emitted: string[] = [];
      const batcher = new AssistantDeltaBatcher((text) => emitted.push(text));
      batcher.push('waiting');
      rstest.advanceTimersByTime(ASSISTANT_DELTA_BATCH_MS - 1);
      expect(emitted).toEqual([]);
      rstest.advanceTimersByTime(1);
      expect(emitted).toEqual(['waiting']);

      const unicode = '界🙂'.repeat(ASSISTANT_DELTA_BATCH_BYTES);
      batcher.push(unicode);
      batcher.flush();
      expect(emitted.slice(1).join('')).toBe(unicode);
      expect(
        emitted.slice(1).every((text) =>
          Buffer.byteLength(text) <= ASSISTANT_DELTA_BATCH_BYTES
        ),
      ).toBe(true);
    } finally {
      rstest.useRealTimers();
    }
  });

  test('coalesces 5,000 tiny Codex deltas and preserves non-delta ordering', async () => {
    const streamed: Array<{ type: string; text?: string }> = [];
    const store = new PlaygroundStore(root, {
      onEvent: (_conversationId, event) => {
        if (
          event.type === 'assistant.delta' || event.type === 'activity'
        ) {
          streamed.push({
            type: event.type,
            ...(typeof event.payload === 'object' && event.payload
                && 'text' in event.payload
                && typeof event.payload.text === 'string'
              ? { text: event.payload.text }
              : {}),
          });
        }
      },
    });
    const ids = seed(store);
    const engine = new PlaygroundEngine(
      store,
      adapters([], async function*() {
        await Promise.resolve();
        for (let index = 0; index < 5_000; index += 1) {
          yield { type: 'assistant_delta' as const, text: 'x' };
        }
        yield { type: 'activity' as const, text: 'checking' };
        yield { type: 'assistant_delta' as const, text: 'tail' };
        yield { type: 'assistant_final' as const, text: ARTIFACT };
      }),
    );
    await engine.submitTurn(ids.conversation, ids.turn, request(ids.session));
    await until(() =>
      store.getTurn(ids.conversation, ids.turn).status === 'completed'
    );
    expect(streamed).toEqual([
      { type: 'assistant.delta', text: 'x'.repeat(5_000) },
      { type: 'activity', text: 'checking' },
      { type: 'assistant.delta', text: 'tail' },
    ]);
    expect(store.get(ids.conversation).conversation.latestRevision).toBe('1');
  });

  test('commits only the final assistant response and one terminal state', async () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const engine = new PlaygroundEngine(
      store,
      adapters([
        { type: 'assistant_delta', text: ARTIFACT.replace('</lynx>', '') },
        { type: 'assistant_final', text: `preface\n${ARTIFACT}` },
        { type: 'assistant_final', text: 'late invalid output' },
      ]),
    );
    await engine.submitTurn(ids.conversation, ids.turn, request(ids.session));
    await until(() =>
      store.getTurn(ids.conversation, ids.turn).status === 'completed'
    );
    const data = store.get(ids.conversation);
    expect(data.conversation.latestRevision).toBe('1');
    expect(data.conversation.latestArtifactHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(
      store.readArtifact(ids.conversation, data.conversation.latestRevision!),
    ).toBe(ARTIFACT);
    expect(
      store.eventsAfter(ids.conversation, 0).filter((event) =>
        event.type === 'turn.completed'
      ),
    ).toHaveLength(1);
  });

  test('cancellation invalidates the lease and permanently ignores late final output', async () => {
    const transientTurnIds: string[] = [];
    const store = new PlaygroundStore(root, {
      onEvent: (_conversationId, event) => {
        if (!event.durable && event.turnId) {
          transientTurnIds.push(event.turnId);
        }
      },
    });
    const ids = seed(store);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => release = resolve);
    const engine = new PlaygroundEngine(
      store,
      adapters([], async function*() {
        yield { type: 'assistant_delta', text: 'working' };
        await gate;
        yield { type: 'assistant_final', text: ARTIFACT };
      }),
    );
    await engine.submitTurn(ids.conversation, ids.turn, request(ids.session));
    await until(() =>
      store.getTurn(ids.conversation, ids.turn).status === 'running'
    );
    engine.cancel(ids.conversation, ids.turn);
    release();
    await new Promise((resolve) =>
      setTimeout(resolve, ASSISTANT_DELTA_BATCH_MS + 25)
    );
    expect(store.getTurn(ids.conversation, ids.turn).status).toBe('cancelled');
    expect(store.get(ids.conversation).conversation.latestRevision)
      .toBeUndefined();
    expect(engine.cancel(ids.conversation, ids.turn).status).toBe('cancelled');
    expect(
      store.eventsAfter(ids.conversation, 0).filter((event) =>
        event.type === 'turn.cancelled'
      ),
    ).toHaveLength(1);
    const nextSession = randomUUID();
    const nextTurn = randomUUID();
    store.putSession(ids.conversation, nextSession, { agentId: 'codex' });
    await engine.submitTurn(ids.conversation, nextTurn, request(nextSession));
    await until(() =>
      store.getTurn(ids.conversation, nextTurn).status === 'completed'
    );
    expect(store.get(ids.conversation).conversation.latestRevision).toBe('1');
    expect(terminalEvents(store, ids.conversation, nextTurn)).toHaveLength(1);
    expect(transientTurnIds).not.toContain(ids.turn);
  });

  test('discards a pending delta when the Agent fails', async () => {
    const transient: string[] = [];
    const store = new PlaygroundStore(root, {
      onEvent: (_conversationId, event) => {
        if (!event.durable) transient.push(event.type);
      },
    });
    const ids = seed(store);
    const engine = new PlaygroundEngine(
      store,
      adapters([
        { type: 'assistant_delta', text: 'partial' },
        { type: 'error', message: 'boom' },
      ]),
    );
    await engine.submitTurn(ids.conversation, ids.turn, request(ids.session));
    await until(() =>
      store.getTurn(ids.conversation, ids.turn).status === 'failed'
    );
    await new Promise((resolve) =>
      setTimeout(resolve, ASSISTANT_DELTA_BATCH_MS + 25)
    );
    expect(transient).toEqual([]);
  });

  test('enforces global serialization and capability gaps', async () => {
    const store = new PlaygroundStore(root);
    const first = seed(store);
    const second = seed(store);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => release = resolve);
    const engine = new PlaygroundEngine(
      store,
      adapters([], async function*() {
        await gate;
        yield { type: 'assistant_final', text: ARTIFACT };
      }, false),
    );
    await expect(
      engine.submitTurn(first.conversation, first.turn, {
        ...request(first.session),
        model: 'unsupported',
      }),
    ).rejects.toThrow(/model selection/);
    await engine.submitTurn(
      first.conversation,
      first.turn,
      request(first.session),
    );
    await expect(
      engine.submitTurn(
        second.conversation,
        second.turn,
        request(second.session),
      ),
    ).rejects.toThrow(/already active/);
    release();
    await until(() =>
      store.getTurn(first.conversation, first.turn).status === 'completed'
    );
  });

  test('keeps the global slot until the managed process has closed', async () => {
    const store = new PlaygroundStore(root);
    const first = seed(store);
    const second = seed(store);
    let releaseClose!: () => void;
    const closeGate = new Promise<void>((resolve) => releaseClose = resolve);
    const adapter = [
      ...adapters([{ type: 'assistant_final', text: ARTIFACT }])
        .values(),
    ][0]!;
    adapter.launch = () => ({
      events: (async function*() {
        await Promise.resolve();
        yield { type: 'assistant_final' as const, text: ARTIFACT };
      })(),
      cancel() {
        // The fake process has no cancellation side effect.
      },
      close: async () => await closeGate,
    });
    const engine = new PlaygroundEngine(
      store,
      new Map<AgentId, AgentAdapter>([['codex', adapter]]),
    );
    await engine.submitTurn(
      first.conversation,
      first.turn,
      request(first.session),
    );
    await until(() =>
      store.getTurn(first.conversation, first.turn).status === 'completed'
    );
    await expect(
      engine.submitTurn(
        second.conversation,
        second.turn,
        request(second.session),
      ),
    ).rejects.toThrow(/already active/);
    releaseClose();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await engine.submitTurn(
      second.conversation,
      second.turn,
      request(second.session),
    );
    releaseClose();
    await until(() =>
      store.getTurn(second.conversation, second.turn).status === 'completed'
    );
  });

  test('does not spawn twice when an accepted turn response is retried', async () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    let launches = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => release = resolve);
    const adapter = [
      ...adapters([], async function*() {
        await gate;
        yield { type: 'assistant_final', text: ARTIFACT };
      }).values(),
    ][0]!;
    const launch = adapter.launch.bind(adapter);
    adapter.launch = (launchRequest) => {
      launches += 1;
      return launch(launchRequest);
    };
    const engine = new PlaygroundEngine(
      store,
      new Map<AgentId, AgentAdapter>([['codex', adapter]]),
    );
    const turnRequest = request(ids.session);
    const created = await engine.submitTurn(
      ids.conversation,
      ids.turn,
      turnRequest,
    );
    expect(created.created).toBe(true);
    const repeated = await engine.submitTurn(
      ids.conversation,
      ids.turn,
      turnRequest,
    );
    expect(repeated.created).toBe(false);
    expect(launches).toBe(1);
    release();
    await until(() =>
      store.getTurn(ids.conversation, ids.turn).status === 'completed'
    );
  });

  test('lists models and validates a selected model before launching', async () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store, {
      model: 'fixture-model',
      effort: 'medium',
    });
    const adapter = [
      ...adapters([
        { type: 'assistant_final', text: ARTIFACT },
      ]).values(),
    ][0]!;
    const catalogCalls: boolean[] = [];
    adapter.listModels = (forceRefresh = false) => {
      catalogCalls.push(forceRefresh);
      return Promise.resolve({
        status: 'ready',
        models: [{
          value: 'fixture-model',
          label: 'Fixture model',
          efforts: ['low', 'medium'],
        }],
      });
    };
    let launchRequest: Parameters<AgentAdapter['launch']>[0] | undefined;
    const launch = adapter.launch.bind(adapter);
    adapter.launch = (request) => {
      launchRequest = request;
      return launch(request);
    };
    const engine = new PlaygroundEngine(
      store,
      new Map<AgentId, AgentAdapter>([['codex', adapter]]),
    );
    await expect(engine.modelCatalog('codex')).resolves.toMatchObject({
      status: 'ready',
      models: [{ value: 'fixture-model', efforts: ['low', 'medium'] }],
    });
    await engine.submitTurn(ids.conversation, ids.turn, {
      ...request(ids.session),
      model: 'fixture-model',
      effort: 'medium',
    });
    await until(() =>
      store.getTurn(ids.conversation, ids.turn).status === 'completed'
    );
    expect(launchRequest).toMatchObject({
      model: 'fixture-model',
      effort: 'medium',
    });
    expect(catalogCalls).toEqual([false, false]);
  });

  test('force-refreshes one stale model catalog before rejecting the turn', async () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const adapter = [...adapters([]).values()][0]!;
    const calls: boolean[] = [];
    adapter.listModels = (forceRefresh = false) => {
      calls.push(forceRefresh);
      return Promise.resolve({
        status: 'ready',
        models: [{ value: 'available', label: 'Available' }],
      });
    };
    const engine = new PlaygroundEngine(
      store,
      new Map<AgentId, AgentAdapter>([['codex', adapter]]),
    );
    await expect(engine.submitTurn(ids.conversation, ids.turn, {
      ...request(ids.session),
      model: 'removed-model',
    })).rejects.toMatchObject({
      status: 400,
      code: 'MODEL_NOT_AVAILABLE',
    });
    expect(calls).toEqual([false, true]);
    expect(() => store.getTurn(ids.conversation, ids.turn)).toThrow();
  });

  test('rejects an effort that is not supported by the selected model', async () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const adapter = [...adapters([]).values()][0]!;
    adapter.listModels = async () => ({
      status: 'ready',
      models: [{
        value: 'fixture-model',
        label: 'Fixture model',
        efforts: ['low'],
      }],
    });
    const engine = new PlaygroundEngine(
      store,
      new Map<AgentId, AgentAdapter>([['codex', adapter]]),
    );
    await expect(engine.submitTurn(ids.conversation, ids.turn, {
      ...request(ids.session),
      model: 'fixture-model',
      effort: 'high',
    })).rejects.toMatchObject({
      status: 400,
      code: 'EFFORT_NOT_AVAILABLE',
    });
  });

  test('retains the previous revision when final output is invalid', async () => {
    const store = new PlaygroundStore(root);
    const first = seed(store);
    store.acceptTurn(first.conversation, first.turn, request(first.session));
    store.updateTurn(first.conversation, first.turn, { status: 'running' });
    const revision = store.commitArtifact(
      first.conversation,
      first.turn,
      ARTIFACT,
    );
    store.updateTurn(first.conversation, first.turn, {
      status: 'completed',
      revision,
    });
    const nextSession = randomUUID();
    const nextTurn = randomUUID();
    store.putSession(first.conversation, nextSession, { agentId: 'codex' });
    const engine = new PlaygroundEngine(
      store,
      adapters([{ type: 'assistant_final', text: 'not Lynx XML' }]),
    );
    await engine.submitTurn(first.conversation, nextTurn, request(nextSession));
    await until(() =>
      store.getTurn(first.conversation, nextTurn).status === 'failed'
    );
    expect(store.get(first.conversation).conversation.latestRevision).toBe(
      revision,
    );
    expect(store.readArtifact(first.conversation, revision)).toBe(ARTIFACT);
    expect(
      store.eventsAfter(first.conversation, 0).some((event) =>
        event.turnId === nextTurn && event.type === 'message.assistant'
      ),
    ).toBe(false);
  });

  test('times out, cancels the native run, ignores a late final, and leaves the next turn clean', async () => {
    const store = new PlaygroundStore(root);
    const first = seed(store);
    let cancelled = 0;
    let releaseLate!: () => void;
    const lateGate = new Promise<void>((resolve) => releaseLate = resolve);
    const adapter = [...adapters([]).values()][0]!;
    let launch = 0;
    adapter.launch = () => {
      launch += 1;
      if (launch === 2) {
        return {
          events: (async function*() {
            await Promise.resolve();
            yield { type: 'assistant_final' as const, text: ARTIFACT };
          })(),
          cancel() {
            // No process exists in the successful fake run.
          },
          close: async () => await Promise.resolve(),
        };
      }
      return {
        events: (async function*() {
          await lateGate;
          yield { type: 'assistant_final' as const, text: ARTIFACT };
        })(),
        cancel() {
          cancelled += 1;
        },
        close: async () => await Promise.resolve(),
      };
    };
    const engine = new PlaygroundEngine(
      store,
      new Map<AgentId, AgentAdapter>([['codex', adapter]]),
      process.cwd(),
      10,
    );
    await engine.submitTurn(
      first.conversation,
      first.turn,
      request(first.session),
    );
    await until(() =>
      store.getTurn(first.conversation, first.turn).status === 'failed'
    );
    expect(cancelled).toBe(1);
    expect(store.getTurn(first.conversation, first.turn).error).toMatch(
      /deadline/,
    );
    releaseLate();
    const nextSession = randomUUID();
    const nextTurn = randomUUID();
    store.putSession(first.conversation, nextSession, { agentId: 'codex' });
    await engine.submitTurn(first.conversation, nextTurn, request(nextSession));
    await until(() =>
      store.getTurn(first.conversation, nextTurn).status === 'completed'
    );
    expect(store.get(first.conversation).conversation.latestRevision).toBe('1');
    expect(terminalEvents(store, first.conversation, first.turn)).toHaveLength(
      1,
    );
    expect(terminalEvents(store, first.conversation, nextTurn)).toHaveLength(1);
  });

  test('persists bounded usage, policy, process-exit, and assistant summaries', async () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const adapter = [
      ...adapters([
        { type: 'usage', inputTokens: 12, outputTokens: 5 },
        { type: 'policy_blocked', reason: 'token=private cannot run' },
        { type: 'assistant_final', text: ARTIFACT },
      ]).values(),
    ][0]!;
    adapter.launch = () => ({
      events: (async function*() {
        await Promise.resolve();
        yield { type: 'usage' as const, inputTokens: 12, outputTokens: 5 };
        yield {
          type: 'policy_blocked' as const,
          reason: 'token=private cannot run',
        };
        yield { type: 'assistant_final' as const, text: ARTIFACT };
      })(),
      processId: 123,
      exit: Promise.resolve({ code: 0, signal: null }),
      cancel() {
        // No process exists in the completed fake run.
      },
      close: async () => await Promise.resolve(),
    });
    const engine = new PlaygroundEngine(
      store,
      new Map<AgentId, AgentAdapter>([['codex', adapter]]),
    );
    await engine.submitTurn(ids.conversation, ids.turn, request(ids.session));
    await until(() =>
      store.eventsAfter(ids.conversation, 0).some((event) =>
        event.type === 'process.exit'
      )
    );
    const serialized = fs.readFileSync(
      path.join(root, 'sessions', ids.conversation, 'events.jsonl'),
      'utf8',
    );
    expect(serialized).toContain('message.user');
    expect(serialized).toContain('message.assistant');
    expect(serialized).toContain('process.exit');
    expect(serialized).toContain('usage');
    expect(serialized).toContain('policy.blocked');
    expect(serialized).not.toContain('token=private');
    expect(serialized).not.toContain(ARTIFACT);
    expect(serialized).not.toContain('Build it');
  });

  test('maps one native approval identity to one browser UUID and callback', async () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    let resolved = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => release = resolve);
    const respond = (): void => {
      resolved += 1;
      release();
    };
    const approval = {
      type: 'approval' as const,
      requestId: 'number:45',
      prompt: 'Run pwd',
      decisions: ['allow_once', 'deny'] as const,
      respond,
      cancel: () => undefined,
    };
    const engine = new PlaygroundEngine(
      store,
      adapters([], async function*() {
        yield approval;
        yield { ...approval };
        await gate;
        yield { type: 'assistant_final', text: ARTIFACT };
      }),
    );
    await engine.submitTurn(ids.conversation, ids.turn, request(ids.session));
    await until(() =>
      store.eventsAfter(ids.conversation, 0).some((event) =>
        event.type === 'approval.requested'
      )
    );
    const requests = store.eventsAfter(ids.conversation, 0).filter((event) =>
      event.type === 'approval.requested'
    );
    expect(requests).toHaveLength(1);
    const requestId = (requests[0]!.payload as { requestId: string }).requestId;
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    engine.approve(ids.conversation, requestId, 'allow_once');
    await until(() =>
      store.getTurn(ids.conversation, ids.turn).status === 'completed'
    );
    expect(resolved).toBe(1);
  });

  test('cancels a pending transport permission without recording a user decision', async () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    let transportCancelled = 0;
    const engine = new PlaygroundEngine(
      store,
      adapters([], async function*() {
        yield {
          type: 'approval' as const,
          requestId: 'number:46',
          prompt: 'Run pwd',
          decisions: ['allow_once', 'deny'] as const,
          respond: () => undefined,
          cancel: () => transportCancelled += 1,
        };
        await new Promise<void>(() => undefined);
      }),
    );
    await engine.submitTurn(ids.conversation, ids.turn, request(ids.session));
    await until(() =>
      store.getTurn(ids.conversation, ids.turn).status === 'awaiting_approval'
    );
    engine.cancel(ids.conversation, ids.turn);
    expect(transportCancelled).toBe(1);
    expect(
      store.eventsAfter(ids.conversation, 0).filter((event) =>
        event.type === 'approval.resolved'
      ),
    ).toHaveLength(0);
    expect(terminalEvents(store, ids.conversation, ids.turn)).toHaveLength(1);
  });
});

function terminalEvents(
  store: PlaygroundStore,
  conversationId: string,
  turnId: string,
) {
  return store.eventsAfter(conversationId, 0).filter((event) =>
    event.turnId === turnId
    && ['turn.completed', 'turn.failed', 'turn.cancelled', 'turn.interrupted']
      .includes(event.type)
  );
}

function adapters(
  events: AgentEvent[],
  generate: () => AsyncIterable<AgentEvent> = async function*() {
    await Promise.resolve();
    yield* events;
  },
  models = true,
): Map<AgentId, AgentAdapter> {
  const adapter: AgentAdapter = {
    descriptor: {
      id: 'codex',
      name: 'Fake',
      command: ['fake'],
      protocol: 'codex-app-server',
      available: true,
      authentication: 'authenticated',
      efforts: models ? ['low', 'medium', 'high'] : [],
      capabilities: {
        models,
        effort: models,
        tools: true,
        approvals: true,
        cancellation: true,
      },
    },
    listModels: async () =>
      models
        ? {
          status: 'ready' as const,
          models: [{
            value: 'fixture-model',
            label: 'Fixture model',
            efforts: ['low', 'medium', 'high'],
          }],
        }
        : {
          status: 'unsupported' as const,
          reason: 'agent-does-not-expose-model-list' as const,
          models: [],
        },
    launch: () => ({
      events: generate(),
      cancel() {
        // No child process exists in the fake adapter.
      },
      close: async () => {
        await Promise.resolve();
      },
    }),
  };
  return new Map([['codex', adapter]]);
}

function request(sessionId: string) {
  return { sessionId, agentId: 'codex' as const, prompt: 'Build it' };
}

function seed(
  store: PlaygroundStore,
  configuration: { model?: string; effort?: string } = {},
) {
  const conversation = randomUUID();
  const session = randomUUID();
  const turn = randomUUID();
  store.putConversation(conversation, { title: 'Test' });
  store.putSession(conversation, session, {
    agentId: 'codex',
    ...configuration,
  });
  return { conversation, session, turn };
}

async function until(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out');
}
