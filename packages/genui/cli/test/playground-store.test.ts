// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  PlaygroundStore,
  nextDurableTurnEventUsage,
} from '../src/playground/store.js';
import {
  DURABLE_TURN_EVENT_BYTES_LIMIT,
  DURABLE_TURN_EVENT_COUNT_LIMIT,
  PlaygroundError,
} from '../src/playground/types.js';

const ARTIFACT =
  '<!doctype lynx>\n<lynx engine-version="4.2">\n<script thread="main">\nconst page = __CreatePage("0", 0);\n</script>\n</lynx>';

describe('PlaygroundStore', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-store-'),
    );
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('persists idempotent requests and rejects conflicting UUID reuse', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const request = {
      sessionId: ids.session,
      agentId: 'codex' as const,
      prompt: 'Build it',
    };
    expect(store.acceptTurn(ids.conversation, ids.turn, request).created).toBe(
      true,
    );
    expect(store.acceptTurn(ids.conversation, ids.turn, request).created).toBe(
      false,
    );
    expect(() =>
      store.acceptTurn(ids.conversation, ids.turn, {
        ...request,
        prompt: 'Different',
      })
    ).toThrow(/Conflicting/);
  });

  test('rejects prompts over 128 KiB before accepting the turn', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    expect(() =>
      store.acceptTurn(ids.conversation, ids.turn, {
        sessionId: ids.session,
        agentId: 'codex',
        prompt: 'x'.repeat(128 * 1024 + 1),
      })
    ).toThrow(/128 KiB/);
    expect(store.get(ids.conversation).turns).toHaveLength(0);
  });

  test('rejects conflicting conversation and session request reuse', () => {
    const store = new PlaygroundStore(root);
    const conversation = randomUUID();
    const session = randomUUID();
    store.putConversation(conversation, { title: 'First' });
    expect(store.putConversation(conversation, { title: 'First' }).created)
      .toBe(false);
    expect(() => store.putConversation(conversation, { title: 'Second' }))
      .toThrow(/Conflicting/);
    store.putSession(conversation, session, { agentId: 'codex' });
    expect(
      store.putSession(conversation, session, { agentId: 'codex' }).created,
    ).toBe(false);
    expect(() => store.putSession(conversation, session, { agentId: 'claude' }))
      .toThrow(/Conflicting/);
  });

  test('atomically commits only a running valid final artifact and retains prior revision', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    store.acceptTurn(ids.conversation, ids.turn, {
      sessionId: ids.session,
      agentId: 'codex',
      prompt: 'Build it',
    });
    store.updateTurn(ids.conversation, ids.turn, { status: 'running' });
    const revision = store.commitArtifact(
      ids.conversation,
      ids.turn,
      `preamble\n${ARTIFACT}\npostscript`,
    );
    expect(store.readArtifact(ids.conversation, revision)).toBe(ARTIFACT);
    store.updateTurn(ids.conversation, ids.turn, { status: 'cancelled' });
    expect(() => store.commitArtifact(ids.conversation, ids.turn, ARTIFACT))
      .toThrow(/lease/);
    expect(store.get(ids.conversation).conversation.latestRevision).toBe(
      revision,
    );
  });

  test('does not expose an orphan artifact without a committed revision pointer', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    fs.writeFileSync(
      path.join(root, 'sessions', ids.conversation, 'artifacts', '1.lynxml'),
      ARTIFACT,
    );
    expect(() => store.readArtifact(ids.conversation, '1')).toThrow(
      /not found/,
    );
  });

  test('restores archived state and marks in-flight turns interrupted without rerunning', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    store.patchConversation(ids.conversation, { archived: true });
    store.acceptTurn(ids.conversation, ids.turn, {
      sessionId: ids.session,
      agentId: 'codex',
      prompt: 'Build it',
    });
    store.updateTurn(ids.conversation, ids.turn, { status: 'running' });

    const restored = new PlaygroundStore(root);
    const data = restored.get(ids.conversation);
    expect(data.conversation.archived).toBe(true);
    expect(data.turns).toHaveLength(1);
    expect(data.turns[0]!.status).toBe('interrupted');
    expect(restored.eventsAfter(ids.conversation, 0).at(-1)?.type).toBe(
      'turn.interrupted',
    );
    const terminalEvents = restored.eventsAfter(ids.conversation, 0).length;
    const restoredAgain = new PlaygroundStore(root);
    expect(restoredAgain.eventsAfter(ids.conversation, 0)).toHaveLength(
      terminalEvents,
    );
  });

  test('keeps durable monotonic sequences and marks oversized event payloads truncated', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const first = store.emit(ids.conversation, 'bounded.fixture', {
      text: 'one',
    });
    const second = store.emit(ids.conversation, 'bounded.fixture', {
      text: 'x'.repeat(300_000),
    });
    expect(second.sequence).toBe(first.sequence + 1);
    expect(second.truncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(second.payload)))
      .toBeLessThanOrEqual(
        256 * 1024,
      );
    const restored = new PlaygroundStore(root);
    expect(restored.eventsAfter(ids.conversation, first.sequence)).toEqual([
      second,
    ]);
  });

  test('does not reuse a transient sequence after restart', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const transient = store.emitTransient(
      ids.conversation,
      'assistant.delta',
      { text: 'not durable' },
      ids.turn,
    );
    const restored = new PlaygroundStore(root);
    const durable = restored.emit(ids.conversation, 'activity', {
      text: 'after restart',
    });
    expect(durable.sequence).toBeGreaterThan(transient.sequence);
    expect(restored.eventsAfter(ids.conversation, 0)).not.toContainEqual(
      transient,
    );
  });

  test('does not treat delivered transient deltas as a retained buffer', () => {
    const transientEvents: string[] = [];
    const store = new PlaygroundStore(root, {
      onEvent: (_conversationId, event) => {
        if (!event.durable) transientEvents.push(event.type);
      },
    });
    const ids = seed(store);
    for (let index = 0; index < 5_000; index += 1) {
      store.emitTransient(
        ids.conversation,
        'assistant.delta',
        { text: 'x' },
        ids.turn,
      );
    }
    expect(transientEvents).toHaveLength(5_000);
    expect(
      store.eventsAfter(ids.conversation, 0).filter((event) =>
        event.type === 'assistant.delta'
      ),
    ).toHaveLength(0);
  });

  test('fails closed when the durable turn event log exceeds its limit', () => {
    expect(() =>
      nextDurableTurnEventUsage(
        { count: DURABLE_TURN_EVENT_COUNT_LIMIT, bytes: 0 },
        1,
      )
    ).toThrow(/10001 events.*10000 events/iu);
    try {
      nextDurableTurnEventUsage(
        { count: 0, bytes: DURABLE_TURN_EVENT_BYTES_LIMIT },
        1,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PlaygroundError);
      if (!(error instanceof PlaygroundError)) throw error;
      expect(error.code).toBe('TURN_EVENT_LOG_OVERFLOW');
      expect(error.message).toMatch(/16777217 bytes.*16777216 bytes/iu);
    }
  });

  test('keeps emitted event payloads immutable as records change', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const accepted = store.acceptTurn(ids.conversation, ids.turn, {
      sessionId: ids.session,
      agentId: 'codex',
      prompt: 'Build it',
    }).turn;
    const event = store.emit(
      ids.conversation,
      'turn.snapshot',
      { turn: accepted },
      ids.turn,
    );
    store.updateTurn(ids.conversation, ids.turn, { status: 'running' });
    expect((event.payload as { turn: { status: string } }).turn.status).toBe(
      'accepted',
    );
    expect(
      (store.eventsAfter(ids.conversation, 0).at(-1)!.payload as {
        turn: { status: string };
      }).turn.status,
    ).toBe('accepted');
  });

  test('uses private directory and file permissions', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const conversationRoot = path.join(root, 'sessions', ids.conversation);
    expect(fs.statSync(root).mode & 0o777).toBe(0o700);
    expect(fs.statSync(conversationRoot).mode & 0o777).toBe(0o700);
    expect(
      fs.statSync(path.join(conversationRoot, 'session.json')).mode & 0o777,
    ).toBe(0o600);
  });

  test('rejects path traversal and non-UUID identifiers', () => {
    const store = new PlaygroundStore(root);
    expect(() => store.putConversation('../escape', {})).toThrow(/UUID/);
    expect(() => store.putConversation('not-a-uuid', {})).toThrow(/UUID/);
  });

  test('refuses a symbolic-link data root', () => {
    const target = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-root-target-'),
    );
    const link = path.join(root, 'linked-root');
    fs.symlinkSync(target, link);
    try {
      expect(() => new PlaygroundStore(link)).toThrow(/data directory/iu);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test('refuses a symbolic-link ancestor before creating a data root', () => {
    const container = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-root-ancestor-'),
    );
    const target = path.join(container, 'real-parent');
    const link = path.join(container, 'link-parent');
    fs.mkdirSync(target);
    fs.symlinkSync(target, link);
    try {
      expect(() => new PlaygroundStore(path.join(link, 'data'))).toThrow(
        /symbolic link.*ancestry/iu,
      );
      expect(fs.existsSync(path.join(target, 'data'))).toBe(false);
    } finally {
      fs.rmSync(container, { recursive: true, force: true });
    }
  });

  test('ignores a half-written final events line during recovery', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const events = path.join(
      root,
      'sessions',
      ids.conversation,
      'events.jsonl',
    );
    fs.appendFileSync(events, '{"sequence":');
    const restored = new PlaygroundStore(root);
    expect(restored.eventsAfter(ids.conversation, 0).length).toBeGreaterThan(0);
  });

  test('skips records outside the current strict structure without rewriting them', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    const sessionFile = path.join(
      root,
      'sessions',
      ids.conversation,
      'session.json',
    );
    const original = fs.readFileSync(sessionFile, 'utf8');
    const record = JSON.parse(original) as Record<string, unknown>;
    record['obsoleteMarker'] = true;
    fs.writeFileSync(sessionFile, JSON.stringify(record));

    const restored = new PlaygroundStore(root);
    expect(restored.list()).toEqual([]);
    expect(restored.recoveryWarnings).toEqual([
      `Skipped invalid conversation ${ids.conversation}`,
    ]);
    expect(JSON.parse(fs.readFileSync(sessionFile, 'utf8'))).toMatchObject({
      obsoleteMarker: true,
    });
  });

  test('refuses symlinked artifact reads', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    store.acceptTurn(ids.conversation, ids.turn, {
      sessionId: ids.session,
      agentId: 'codex',
      prompt: 'Build it',
    });
    store.updateTurn(ids.conversation, ids.turn, { status: 'running' });
    store.commitArtifact(ids.conversation, ids.turn, ARTIFACT);
    const target = path.join(root, 'target');
    fs.writeFileSync(target, 'secret');
    fs.rmSync(
      path.join(root, 'sessions', ids.conversation, 'artifacts', '1.lynxml'),
    );
    fs.symlinkSync(
      target,
      path.join(root, 'sessions', ids.conversation, 'artifacts', '1.lynxml'),
    );
    expect(() => store.readArtifact(ids.conversation, '1')).toThrow(
      /symbolic link/,
    );
  });

  test('returns a bounded snapshot with sequence, cursor metadata, and pending approvals', () => {
    const store = new PlaygroundStore(root);
    const ids = seed(store);
    for (let index = 0; index < 3; index += 1) {
      const turnId = index === 0 ? ids.turn : randomUUID();
      store.acceptTurn(ids.conversation, turnId, {
        sessionId: ids.session,
        agentId: 'codex',
        prompt: `Prompt ${index}`,
      });
      store.updateTurn(ids.conversation, turnId, {
        status: index === 2 ? 'awaiting_approval' : 'completed',
      });
      if (index === 2) {
        store.emit(ids.conversation, 'approval.requested', {
          requestId: 'approval-1',
          prompt: 'token=private approve?',
        }, turnId);
      }
    }
    const snapshot = store.snapshot(ids.conversation, 0, 2);
    expect(snapshot.turns).toHaveLength(2);
    expect(snapshot.sequence).toBeGreaterThan(0);
    expect(snapshot.pagination).toMatchObject({
      cursor: 0,
      limit: 2,
      nextCursor: 2,
      truncated: true,
      totalTurns: 3,
    });
    expect(snapshot.pendingApprovals).toEqual([{
      requestId: 'approval-1',
      turnId: snapshot.turns[1]!.id,
      prompt: 'token=[redacted] approve?',
      decisions: ['deny'],
    }]);
  });

  test('refuses nested symbolic links in conversation, turn, and artifact paths', () => {
    const outside = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-outside-'),
    );
    try {
      const store = new PlaygroundStore(root);
      const ids = seed(store);
      const conversationRoot = path.join(root, 'sessions', ids.conversation);
      fs.rmSync(path.join(conversationRoot, 'turns'), {
        recursive: true,
        force: true,
      });
      fs.symlinkSync(outside, path.join(conversationRoot, 'turns'));
      expect(() =>
        store.acceptTurn(ids.conversation, ids.turn, {
          sessionId: ids.session,
          agentId: 'codex',
          prompt: 'safe',
        })
      ).toThrow(/symbolic link/iu);
      fs.rmSync(path.join(conversationRoot, 'turns'));
      fs.mkdirSync(path.join(conversationRoot, 'turns'));
      store.acceptTurn(ids.conversation, ids.turn, {
        sessionId: ids.session,
        agentId: 'codex',
        prompt: 'safe',
      });
      store.updateTurn(ids.conversation, ids.turn, { status: 'running' });
      store.commitArtifact(ids.conversation, ids.turn, ARTIFACT);
      fs.rmSync(path.join(conversationRoot, 'artifacts'), {
        recursive: true,
        force: true,
      });
      fs.symlinkSync(outside, path.join(conversationRoot, 'artifacts'));
      expect(() => store.readArtifact(ids.conversation, '1')).toThrow(
        /symbolic link/iu,
      );
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('refuses a symlinked conversation directory during recovery', () => {
    const target = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-conversation-'),
    );
    const conversationId = randomUUID();
    fs.mkdirSync(path.join(root, 'sessions'));
    fs.symlinkSync(target, path.join(root, 'sessions', conversationId));
    try {
      const restored = new PlaygroundStore(root);
      expect(restored.conversations.has(conversationId)).toBe(false);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});

function seed(store: PlaygroundStore) {
  const conversation = randomUUID();
  const session = randomUUID();
  const turn = randomUUID();
  store.putConversation(conversation, { title: 'Test' });
  store.putSession(conversation, session, { agentId: 'codex' });
  return { conversation, session, turn };
}
