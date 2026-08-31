// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  appendPrivateLine,
  atomicWriteFile,
  atomicWriteJson,
  ensurePrivateDirectory,
  readJsonFile,
  readPrivateFile,
  safeChild,
} from './files.js';
import {
  ARTIFACT_LIMIT,
  DURABLE_TURN_EVENT_BYTES_LIMIT,
  DURABLE_TURN_EVENT_COUNT_LIMIT,
  EVENT_PAYLOAD_LIMIT,
  PROMPT_LIMIT,
  PlaygroundError,
  UUID_PATTERN,
  requireUuid,
} from './types.js';
import type {
  ApprovalRecord,
  ConversationRecord,
  ConversationSession,
  DurableEvent,
  PlaygroundEvent,
  TurnRecord,
  TurnRequest,
} from './types.js';
import { normalizeLynxXmlArtifact } from '../../../lynx-xml/dist/index.js';

const SEQUENCE_RESERVATION_SIZE = 256;

interface LoadedConversation {
  record: ConversationRecord;
  turns: Map<string, TurnRecord>;
  events: DurableEvent[];
  nextSequence: number;
}

export interface ConversationSummary extends ConversationRecord {
  turns: number;
  activeTurn?: string;
}

export interface StoreHooks {
  onEvent?: (conversationId: string, event: PlaygroundEvent) => void;
}

export interface ConversationSnapshot {
  conversation: ConversationRecord;
  turns: TurnRecord[];
  sequence: number;
  pendingApprovals: Array<{
    requestId: string;
    turnId: string;
    prompt: string;
    decisions: ApprovalRecord['decision'][];
  }>;
  pagination: {
    cursor: number;
    limit: number;
    nextCursor: number | null;
    truncated: boolean;
    totalTurns: number;
  };
}

export function nextDurableTurnEventUsage(
  usage: Readonly<{ bytes: number; count: number }>,
  bytes: number,
): { bytes: number; count: number } {
  const nextCount = usage.count + 1;
  const nextBytes = usage.bytes + bytes;
  if (
    nextCount > DURABLE_TURN_EVENT_COUNT_LIMIT
    || nextBytes > DURABLE_TURN_EVENT_BYTES_LIMIT
  ) {
    throw new PlaygroundError(
      413,
      `Durable turn event log limit exceeded: ${nextCount} events / ${nextBytes} bytes (limits: ${DURABLE_TURN_EVENT_COUNT_LIMIT} events / ${DURABLE_TURN_EVENT_BYTES_LIMIT} bytes)`,
      'TURN_EVENT_LOG_OVERFLOW',
    );
  }
  return { count: nextCount, bytes: nextBytes };
}

export class PlaygroundStore {
  readonly dataRoot: string;
  readonly conversations: Map<string, LoadedConversation> = new Map();
  readonly recoveryWarnings: string[] = [];
  private readonly durableEventUsage = new Map<
    string,
    { bytes: number; count: number }
  >();
  private readonly restoredInterrupted: Array<
    { conversationId: string; turn: TurnRecord }
  > = [];

  constructor(
    dataRoot: string,
    private readonly hooks: StoreHooks = {},
  ) {
    ensurePrivateDirectory(dataRoot);
    this.dataRoot = fs.realpathSync(dataRoot);
    ensurePrivateDirectory(this.conversationsRoot);
    this.restore();
    for (const { conversationId, turn } of this.restoredInterrupted) {
      this.emit(conversationId, 'turn.interrupted', { turn }, turn.id);
      this.releaseTurnEventLogBudget(turn.id);
    }
  }

  get conversationsRoot(): string {
    return safeChild(this.dataRoot, 'sessions');
  }

  list(): ConversationSummary[] {
    return [...this.conversations.values()]
      .map(({ record, turns }) => {
        const activeTurn = [...turns.values()].find((turn) =>
          isActiveStatus(turn.status)
        )?.id;
        return {
          ...record,
          turns: turns.size,
          ...(activeTurn ? { activeTurn } : {}),
        };
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  get(conversationId: string): {
    conversation: ConversationRecord;
    turns: TurnRecord[];
  } {
    const loaded = this.requireConversation(conversationId);
    return {
      conversation: loaded.record,
      turns: [...loaded.turns.values()].sort((a, b) =>
        a.acceptedAt.localeCompare(b.acceptedAt)
      ),
    };
  }

  snapshot(
    conversationId: string,
    cursor = 0,
    limit = 200,
  ): ConversationSnapshot {
    const loaded = this.requireConversation(conversationId);
    const turns = [...loaded.turns.values()].sort((a, b) =>
      a.acceptedAt.localeCompare(b.acceptedAt)
    );
    const end = Math.max(0, turns.length - cursor);
    const start = Math.max(0, end - limit);
    return {
      conversation: loaded.record,
      turns: turns.slice(start, end),
      sequence: loaded.nextSequence - 1,
      pendingApprovals: pendingApprovals(loaded),
      pagination: {
        cursor,
        limit,
        nextCursor: start > 0 ? cursor + (end - start) : null,
        truncated: start > 0,
        totalTurns: turns.length,
      },
    };
  }

  putConversation(
    conversationId: string,
    input: { title?: unknown },
  ): { created: boolean; conversation: ConversationRecord } {
    conversationId = requireUuid(conversationId, 'conversationId');
    const canonicalRequest = {
      title: typeof input.title === 'string' && input.title.trim()
        ? input.title.trim().slice(0, 200)
        : 'Untitled conversation',
    };
    const createRequestHash = hashJson(canonicalRequest);
    const existing = this.conversations.get(conversationId);
    if (existing) {
      if (existing.record.createRequestHash !== createRequestHash) {
        throw new PlaygroundError(
          409,
          'Conflicting conversation id reuse',
          'ID_CONFLICT',
        );
      }
      return { created: false, conversation: existing.record };
    }

    const now = new Date().toISOString();
    const record: ConversationRecord = {
      id: conversationId,
      title: canonicalRequest.title,
      archived: false,
      createdAt: now,
      updatedAt: now,
      sessions: [],
      createRequestHash,
    };
    const loaded: LoadedConversation = {
      record,
      turns: new Map(),
      events: [],
      nextSequence: 1,
    };
    this.ensureConversationDirectories(conversationId);
    this.conversations.set(conversationId, loaded);
    this.writeConversation(record);
    this.emit(conversationId, 'conversation.created', { conversation: record });
    return { created: true, conversation: record };
  }

  patchConversation(
    conversationId: string,
    patch: { title?: unknown; archived?: unknown },
  ): ConversationRecord {
    const loaded = this.requireConversation(conversationId);
    if (patch.title !== undefined) {
      if (typeof patch.title !== 'string' || !patch.title.trim()) {
        throw new PlaygroundError(400, 'title must be a non-empty string');
      }
      loaded.record.title = patch.title.trim().slice(0, 200);
    }
    if (patch.archived !== undefined) {
      if (typeof patch.archived !== 'boolean') {
        throw new PlaygroundError(400, 'archived must be a boolean');
      }
      loaded.record.archived = patch.archived;
    }
    loaded.record.updatedAt = new Date().toISOString();
    this.writeConversation(loaded.record);
    this.emit(conversationId, 'conversation.updated', {
      conversation: loaded.record,
    });
    return loaded.record;
  }

  putSession(
    conversationId: string,
    sessionId: string,
    input: Omit<ConversationSession, 'id' | 'createdAt'>,
  ): { created: boolean; session: ConversationSession } {
    sessionId = requireUuid(sessionId, 'sessionId');
    const loaded = this.requireConversation(conversationId);
    const existing = loaded.record.sessions.find((session) =>
      session.id === sessionId
    );
    const proposed = {
      id: sessionId,
      agentId: input.agentId,
      ...(input.model ? { model: input.model } : {}),
      ...(input.effort ? { effort: input.effort } : {}),
    };
    if (existing) {
      const comparable = {
        id: existing.id,
        agentId: existing.agentId,
        ...(existing.model ? { model: existing.model } : {}),
        ...(existing.effort ? { effort: existing.effort } : {}),
      };
      if (JSON.stringify(comparable) !== JSON.stringify(proposed)) {
        throw new PlaygroundError(
          409,
          'Conflicting session id reuse',
          'ID_CONFLICT',
        );
      }
      if (loaded.record.currentSessionId !== sessionId) {
        if (hasActiveTurn(loaded)) {
          throw new PlaygroundError(
            409,
            'Cannot switch sessions while a turn is active',
            'ACTIVE_TURN_EXISTS',
          );
        }
        loaded.record.currentSessionId = sessionId;
        loaded.record.updatedAt = new Date().toISOString();
        this.writeConversation(loaded.record);
      }
      return { created: false, session: existing };
    }
    if (hasActiveTurn(loaded)) {
      throw new PlaygroundError(
        409,
        'Cannot switch sessions while a turn is active',
        'ACTIVE_TURN_EXISTS',
      );
    }
    const session: ConversationSession = {
      ...proposed,
      createdAt: new Date().toISOString(),
    };
    loaded.record.sessions.push(session);
    loaded.record.currentSessionId = session.id;
    loaded.record.updatedAt = session.createdAt;
    this.writeConversation(loaded.record);
    this.emit(conversationId, 'session.created', { session });
    return { created: true, session };
  }

  acceptTurn(
    conversationId: string,
    turnId: string,
    request: TurnRequest,
  ): { created: boolean; turn: TurnRecord } {
    turnId = requireUuid(turnId, 'turnId');
    request = {
      ...request,
      sessionId: requireUuid(request.sessionId, 'sessionId'),
    };
    if (Buffer.byteLength(request.prompt) > PROMPT_LIMIT) {
      throw new PlaygroundError(
        413,
        'Prompt exceeds the 128 KiB limit',
        'PROMPT_TOO_LARGE',
      );
    }
    const loaded = this.requireConversation(conversationId);
    if (
      !loaded.record.sessions.some((session) =>
        session.id === request.sessionId
      )
    ) {
      throw new PlaygroundError(404, 'Session not found');
    }
    const session = loaded.record.sessions.find((candidate) =>
      candidate.id === request.sessionId
    )!;
    const requestedConfiguration = {
      agentId: request.agentId,
      ...(request.model ? { model: request.model } : {}),
      ...(request.effort ? { effort: request.effort } : {}),
    };
    const sessionConfiguration = {
      agentId: session.agentId,
      ...(session.model ? { model: session.model } : {}),
      ...(session.effort ? { effort: session.effort } : {}),
    };
    if (
      JSON.stringify(requestedConfiguration)
        !== JSON.stringify(sessionConfiguration)
    ) {
      throw new PlaygroundError(
        409,
        'Turn configuration does not match its session',
        'SESSION_CONFLICT',
      );
    }
    const requestHash = hashJson(request);
    const existing = loaded.turns.get(turnId);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new PlaygroundError(
          409,
          'Conflicting turn id reuse',
          'ID_CONFLICT',
        );
      }
      return { created: false, turn: existing };
    }

    const acceptedAt = new Date().toISOString();
    const turn: TurnRecord = {
      ...request,
      id: turnId,
      conversationId,
      requestHash,
      status: 'accepted',
      acceptedAt,
    };
    this.writeTurn(turn);
    loaded.turns.set(turnId, turn);
    loaded.record.initialRequest ??= request.prompt;
    loaded.record.updatedAt = acceptedAt;
    this.writeConversation(loaded.record);
    this.durableEventUsage.set(turnId, { bytes: 0, count: 0 });
    this.emit(conversationId, 'turn.accepted', { turn }, turnId);
    this.emit(conversationId, 'message.user', {
      summary: 'User submitted a prompt',
      bytes: Buffer.byteLength(request.prompt),
      sha256: createHash('sha256').update(request.prompt).digest('hex'),
    }, turnId);
    return { created: true, turn };
  }

  updateTurn(
    conversationId: string,
    turnId: string,
    patch: Partial<TurnRecord>,
  ): TurnRecord {
    const loaded = this.requireConversation(conversationId);
    const turn = loaded.turns.get(requireUuid(turnId, 'turnId'));
    if (!turn) throw new PlaygroundError(404, 'Turn not found');
    Object.assign(turn, patch);
    this.writeTurn(turn);
    return turn;
  }

  getTurn(conversationId: string, turnId: string): TurnRecord {
    const turn = this.requireConversation(conversationId).turns.get(
      requireUuid(turnId, 'turnId'),
    );
    if (!turn) throw new PlaygroundError(404, 'Turn not found');
    return turn;
  }

  commitArtifact(
    conversationId: string,
    turnId: string,
    value: string,
  ): string {
    const loaded = this.requireConversation(conversationId);
    const turn = this.getTurn(conversationId, turnId);
    if (turn.status !== 'running') {
      throw new PlaygroundError(
        409,
        'Turn lease is no longer active',
        'STALE_TURN_LEASE',
      );
    }
    const artifact = normalizeLynxXmlArtifact(value);
    if (Buffer.byteLength(artifact) > ARTIFACT_LIMIT) {
      throw new PlaygroundError(
        413,
        'Artifact exceeds the 2 MiB limit',
        'ARTIFACT_TOO_LARGE',
      );
    }
    const hash = createHash('sha256').update(artifact).digest('hex');
    const revision = String(nextRevision(loaded.record.latestRevision));
    atomicWriteFile(this.artifactPath(conversationId, revision), artifact);
    loaded.record.latestRevision = revision;
    loaded.record.latestArtifactHash = hash;
    loaded.record.updatedAt = new Date().toISOString();
    this.writeConversation(loaded.record);
    return revision;
  }

  readArtifact(conversationId: string, revision: string): string {
    if (!/^[1-9]\d*$/u.test(revision)) {
      throw new PlaygroundError(400, 'Invalid artifact revision');
    }
    const latest = this.requireConversation(conversationId).record
      .latestRevision;
    if (!latest || Number(revision) > Number(latest)) {
      throw new PlaygroundError(404, 'Artifact not found');
    }
    const file = this.artifactPath(conversationId, revision);
    if (!fs.existsSync(file)) {
      throw new PlaygroundError(404, 'Artifact not found');
    }
    try {
      return readPrivateFile(file);
    } catch (error) {
      throw new PlaygroundError(
        400,
        error instanceof Error ? error.message : 'Unsafe artifact path',
      );
    }
  }

  artifactHash(conversationId: string, revision: string): string {
    const artifact = this.readArtifact(conversationId, revision);
    return createHash('sha256').update(artifact).digest('hex');
  }

  eventsAfter(conversationId: string, after: number): DurableEvent[] {
    return this.requireConversation(conversationId).events.filter((event) =>
      event.sequence > after
    );
  }

  emit(
    conversationId: string,
    type: string,
    payload: unknown,
    turnId?: string,
  ): DurableEvent {
    const loaded = this.requireConversation(conversationId);
    const normalized = truncatePayload(durablePayload(
      type,
      payload,
      turnId ? loaded.turns.get(turnId)?.prompt : undefined,
    ));
    const sequence = this.allocateSequence(loaded);
    const event: DurableEvent = {
      eventId: `${conversationId}:${sequence}`,
      conversationId,
      sequence,
      type,
      timestamp: new Date().toISOString(),
      ...(turnId ? { turnId } : {}),
      ...(turnId && loaded.turns.get(turnId)?.sessionId
        ? { sessionId: loaded.turns.get(turnId)!.sessionId }
        : {}),
      payload: normalized.payload,
      durable: true,
      ...(normalized.truncated ? { truncated: true } : {}),
    };
    if (turnId) {
      this.consumeDurableTurnEventBudget(
        turnId,
        Buffer.byteLength(JSON.stringify(event)) + 1,
      );
    }
    appendPrivateLine(this.eventsPath(conversationId), event);
    loaded.events.push(event);
    this.hooks.onEvent?.(conversationId, event);
    return event;
  }

  emitTransient(
    conversationId: string,
    type: string,
    payload: unknown,
    turnId?: string,
  ): PlaygroundEvent {
    const loaded = this.requireConversation(conversationId);
    const normalized = truncatePayload(payload);
    const sequence = this.allocateSequence(loaded);
    const event: PlaygroundEvent = {
      eventId: `${conversationId}:${sequence}`,
      conversationId,
      sequence,
      type,
      timestamp: new Date().toISOString(),
      ...(turnId ? { turnId } : {}),
      ...(turnId && loaded.turns.get(turnId)?.sessionId
        ? { sessionId: loaded.turns.get(turnId)!.sessionId }
        : {}),
      payload: normalized.payload,
      durable: false,
      ...(normalized.truncated ? { truncated: true } : {}),
    };
    this.hooks.onEvent?.(conversationId, event);
    return event;
  }

  releaseTurnEventLogBudget(turnId: string): void {
    this.durableEventUsage.delete(turnId);
  }

  private consumeDurableTurnEventBudget(turnId: string, bytes: number): void {
    const usage = this.durableEventUsage.get(turnId) ?? {
      bytes: 0,
      count: 0,
    };
    this.durableEventUsage.set(
      turnId,
      nextDurableTurnEventUsage(usage, bytes),
    );
  }

  private allocateSequence(loaded: LoadedConversation): number {
    const sequence = loaded.nextSequence;
    if ((loaded.record.eventSequence ?? 0) >= sequence) {
      loaded.nextSequence += 1;
      return sequence;
    }
    loaded.record.eventSequence = sequence + SEQUENCE_RESERVATION_SIZE - 1;
    this.writeConversation(loaded.record);
    loaded.nextSequence += 1;
    return sequence;
  }

  diskUsage(): number {
    return directorySize(this.dataRoot);
  }

  private restore(): void {
    for (
      const entry of fs.readdirSync(this.conversationsRoot, {
        withFileTypes: true,
      })
    ) {
      if (!entry.isDirectory() || !UUID_PATTERN.test(entry.name)) continue;
      const sessionFile = safeChild(
        this.conversationsRoot,
        entry.name,
        'session.json',
      );
      if (!fs.existsSync(sessionFile)) continue;
      try {
        const record = readJsonFile<unknown>(sessionFile);
        if (!isConversationRecord(record, entry.name)) {
          throw new Error('Invalid conversation record');
        }
        const turns = new Map<string, TurnRecord>();
        const interruptedTurns: TurnRecord[] = [];
        const turnsRoot = safeChild(
          this.conversationsRoot,
          entry.name,
          'turns',
        );
        if (fs.existsSync(turnsRoot)) {
          for (const turnName of fs.readdirSync(turnsRoot)) {
            if (!turnName.endsWith('.json')) continue;
            const turn = readJsonFile<unknown>(
              safeChild(turnsRoot, turnName),
            );
            validateRestoredTurn(turn, entry.name, turnName, record);
            const wasInterrupted = isActiveStatus(turn.status);
            if (wasInterrupted) {
              turn.status = 'interrupted';
              turn.completedAt = new Date().toISOString();
              turn.error =
                'Daemon stopped before the turn reached a terminal state';
              this.writeTurn(turn);
            }
            turns.set(turn.id, turn);
            if (wasInterrupted) {
              interruptedTurns.push(turn);
            }
          }
        }
        const events = readEvents(this.eventsPath(entry.name), entry.name);
        this.conversations.set(entry.name, {
          record,
          turns,
          events,
          nextSequence: Math.max(
            events.at(-1)?.sequence ?? 0,
            Number.isSafeInteger(record.eventSequence)
              ? record.eventSequence ?? 0
              : 0,
          ) + 1,
        });
        for (const turn of interruptedTurns) {
          this.restoredInterrupted.push({ conversationId: entry.name, turn });
        }
      } catch {
        // One damaged conversation must not prevent recovery of the others.
        this.recoveryWarnings.push(
          `Skipped invalid conversation ${entry.name}`,
        );
      }
    }
  }

  private requireConversation(conversationId: string): LoadedConversation {
    const id = requireUuid(conversationId, 'conversationId');
    const loaded = this.conversations.get(id);
    if (!loaded) throw new PlaygroundError(404, 'Conversation not found');
    return loaded;
  }

  private ensureConversationDirectories(conversationId: string): void {
    const root = safeChild(this.conversationsRoot, conversationId);
    ensurePrivateDirectory(root);
    ensurePrivateDirectory(safeChild(root, 'turns'));
    ensurePrivateDirectory(safeChild(root, 'artifacts'));
  }

  private writeConversation(record: ConversationRecord): void {
    this.ensureConversationDirectories(record.id);
    atomicWriteJson(
      safeChild(this.conversationsRoot, record.id, 'session.json'),
      record,
    );
  }

  private writeTurn(turn: TurnRecord): void {
    this.ensureConversationDirectories(turn.conversationId);
    atomicWriteJson(
      safeChild(
        this.conversationsRoot,
        turn.conversationId,
        'turns',
        `${turn.id}.json`,
      ),
      turn,
    );
  }

  private eventsPath(conversationId: string): string {
    return safeChild(this.conversationsRoot, conversationId, 'events.jsonl');
  }

  private artifactPath(conversationId: string, revision: string): string {
    return safeChild(
      this.conversationsRoot,
      requireUuid(conversationId, 'conversationId'),
      'artifacts',
      `${revision}.lynxml`,
    );
  }
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function nextRevision(latest: string | undefined): number {
  if (!latest) return 1;
  const value = Number(latest);
  return Number.isSafeInteger(value) && value > 0 ? value + 1 : 1;
}

function truncatePayload(
  payload: unknown,
): { payload: unknown; truncated: boolean } {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized) <= EVENT_PAYLOAD_LIMIT) {
    // Events are immutable durable facts. Clone the payload before retaining
    // it so later in-memory updates to a turn/session cannot rewrite replay.
    return { payload: JSON.parse(serialized) as unknown, truncated: false };
  }
  // JSON escaping can expand one source character to six bytes. Keep the
  // preview small enough that the normalized JSON payload is always bounded.
  const preview = serialized.slice(0, Math.floor(EVENT_PAYLOAD_LIMIT / 8));
  const truncatedPayload = {
    preview,
    originalBytes: Buffer.byteLength(serialized),
  };
  if (
    Buffer.byteLength(JSON.stringify(truncatedPayload)) > EVENT_PAYLOAD_LIMIT
  ) {
    throw new PlaygroundError(
      413,
      'Event payload cannot be safely truncated',
      'EVENT_TOO_LARGE',
    );
  }
  return {
    payload: truncatedPayload,
    truncated: true,
  };
}

function durablePayload(
  type: string,
  payload: unknown,
  sensitivePrompt?: string,
): unknown {
  if (!isRecord(payload)) return payload;
  if (type === 'conversation.created' || type === 'conversation.updated') {
    const conversation = isRecord(payload['conversation'])
      ? payload['conversation']
      : {};
    return {
      conversation: {
        id: conversation['id'],
        title: sanitizeSummary(stringPayload(conversation['title'])),
        archived: conversation['archived'],
        createdAt: conversation['createdAt'],
        updatedAt: conversation['updatedAt'],
        latestRevision: conversation['latestRevision'],
        latestArtifactHash: conversation['latestArtifactHash'],
        currentSessionId: conversation['currentSessionId'],
      },
    };
  }
  if (type.startsWith('turn.') && isRecord(payload['turn'])) {
    return {
      turn: summarizeTurn(payload['turn']),
      ...(typeof payload['revision'] === 'string'
        ? { revision: payload['revision'] }
        : {}),
      ...(typeof payload['reason'] === 'string'
        ? { reason: sanitizeSummary(payload['reason'], sensitivePrompt) }
        : {}),
      ...(typeof payload['error'] === 'string'
        ? { error: sanitizeSummary(payload['error'], sensitivePrompt) }
        : {}),
    };
  }
  if (type === 'activity') {
    return {
      text: sanitizeSummary(stringPayload(payload['text']), sensitivePrompt),
    };
  }
  if (type === 'session.created') {
    const session = isRecord(payload['session']) ? payload['session'] : {};
    return {
      session: {
        id: session['id'],
        agentId: session['agentId'],
        ...(typeof session['model'] === 'string'
          ? { model: sanitizeSummary(session['model']) }
          : {}),
        ...(typeof session['effort'] === 'string'
          ? { effort: sanitizeSummary(session['effort']) }
          : {}),
        createdAt: session['createdAt'],
      },
    };
  }
  if (type === 'tool') {
    return {
      name: sanitizeSummary(stringPayload(payload['name']), sensitivePrompt),
      status: sanitizeSummary(
        stringPayload(payload['status']),
        sensitivePrompt,
      ),
    };
  }
  if (type === 'approval.requested') {
    return {
      requestId: payload['requestId'],
      prompt: sanitizeSummary(
        stringPayload(payload['prompt']),
        sensitivePrompt,
      ),
      decisions: Array.isArray(payload['decisions'])
        ? payload['decisions'].filter((decision) =>
          decision === 'allow_once' || decision === 'deny'
        )
        : ['deny'],
    };
  }
  if (type === 'policy.blocked') {
    return {
      reason: sanitizeSummary(
        stringPayload(payload['reason']),
        sensitivePrompt,
      ),
    };
  }
  if (type === 'process.exit') {
    return {
      code: finiteExitCode(payload['code']),
      signal: typeof payload['signal'] === 'string'
        ? payload['signal'].slice(0, 32)
        : null,
    };
  }
  if (type === 'usage') {
    return {
      inputTokens: finiteTokenCount(payload['inputTokens']),
      outputTokens: finiteTokenCount(payload['outputTokens']),
    };
  }
  return payload;
}

function summarizeTurn(turn: Record<string, unknown>): Record<string, unknown> {
  return {
    id: turn['id'],
    conversationId: turn['conversationId'],
    sessionId: turn['sessionId'],
    agentId: turn['agentId'],
    status: turn['status'],
    acceptedAt: turn['acceptedAt'],
    ...(turn['startedAt'] ? { startedAt: turn['startedAt'] } : {}),
    ...(turn['completedAt'] ? { completedAt: turn['completedAt'] } : {}),
    ...(turn['revision'] ? { revision: turn['revision'] } : {}),
    ...(typeof turn['error'] === 'string'
      ? { error: sanitizeSummary(turn['error']) }
      : {}),
  };
}

function sanitizeSummary(value: string, sensitivePrompt?: string): string {
  const withoutPrompt = sensitivePrompt
      && value.includes(sensitivePrompt)
    ? value.replaceAll(sensitivePrompt, '[redacted prompt]')
    : value;
  return withoutPrompt.slice(0, 512)
    .replace(/\bbearer\s+[^\s,;]+/giu, 'Bearer [redacted]')
    .replace(
      /\b(api[_-]?key|token|secret|authorization|cookie)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      '$1=[redacted]',
    );
}

function pendingApprovals(
  loaded: LoadedConversation,
): ConversationSnapshot['pendingApprovals'] {
  const pending = new Map<
    string,
    ConversationSnapshot['pendingApprovals'][number]
  >();
  for (const event of loaded.events) {
    if (!event.turnId || !isRecord(event.payload)) continue;
    const requestId = event.payload['requestId'];
    if (typeof requestId !== 'string') continue;
    if (event.type === 'approval.requested') {
      pending.set(requestId, {
        requestId,
        turnId: event.turnId,
        prompt: typeof event.payload['prompt'] === 'string'
          ? event.payload['prompt']
          : 'Agent requests permission',
        decisions: approvalDecisions(event.payload['decisions']),
      });
    } else if (event.type === 'approval.resolved') {
      pending.delete(requestId);
    }
  }
  return [...pending.values()].filter(({ turnId }) => {
    const turn = loaded.turns.get(turnId);
    return turn !== undefined && isActiveStatus(turn.status);
  });
}

function approvalDecisions(value: unknown): ApprovalRecord['decision'][] {
  if (!Array.isArray(value)) return ['deny'];
  const decisions: ApprovalRecord['decision'][] = [];
  for (const decision of value as unknown[]) {
    if (decision === 'allow_once' || decision === 'deny') {
      decisions.push(decision);
    }
  }
  return decisions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const CONVERSATION_KEYS = new Set([
  'id',
  'title',
  'archived',
  'createdAt',
  'updatedAt',
  'initialRequest',
  'eventSequence',
  'latestRevision',
  'latestArtifactHash',
  'currentSessionId',
  'sessions',
  'createRequestHash',
]);
const SESSION_KEYS = new Set([
  'id',
  'agentId',
  'model',
  'effort',
  'createdAt',
]);
const TURN_KEYS = new Set([
  'id',
  'conversationId',
  'sessionId',
  'prompt',
  'agentId',
  'model',
  'effort',
  'requestHash',
  'status',
  'acceptedAt',
  'startedAt',
  'completedAt',
  'revision',
  'error',
  'warnings',
]);
const EVENT_KEYS = new Set([
  'eventId',
  'conversationId',
  'sessionId',
  'sequence',
  'type',
  'timestamp',
  'turnId',
  'payload',
  'durable',
  'truncated',
]);

function isConversationRecord(
  value: unknown,
  conversationId: string,
): value is ConversationRecord {
  if (
    !isRecord(value) || !hasOnlyKeys(value, CONVERSATION_KEYS)
    || value['id'] !== conversationId
    || typeof value['title'] !== 'string'
    || typeof value['archived'] !== 'boolean'
    || typeof value['createdAt'] !== 'string'
    || typeof value['updatedAt'] !== 'string'
    || typeof value['createRequestHash'] !== 'string'
    || !Array.isArray(value['sessions'])
    || !optionalString(value['initialRequest'])
    || !optionalString(value['latestRevision'])
    || !optionalString(value['latestArtifactHash'])
    || !optionalUuid(value['currentSessionId'])
    || (
      value['eventSequence'] !== undefined
      && (!Number.isSafeInteger(value['eventSequence'])
        || Number(value['eventSequence']) < 0)
    )
  ) return false;
  const sessions = value['sessions'];
  if (!sessions.every((session) => isConversationSession(session))) {
    return false;
  }
  const ids = sessions.map((session) => session.id);
  if (new Set(ids).size !== ids.length) return false;
  return value['currentSessionId'] === undefined
    || ids.includes(value['currentSessionId'] as string);
}

function isConversationSession(value: unknown): value is ConversationSession {
  return isRecord(value) && hasOnlyKeys(value, SESSION_KEYS)
    && typeof value['id'] === 'string' && UUID_PATTERN.test(value['id'])
    && isAgentId(value['agentId'])
    && optionalString(value['model'])
    && optionalString(value['effort'])
    && typeof value['createdAt'] === 'string';
}

function isDurableEvent(
  value: unknown,
  conversationId: string,
): value is DurableEvent {
  const sequence = isRecord(value) ? value['sequence'] : undefined;
  if (
    !isRecord(value) || !hasOnlyKeys(value, EVENT_KEYS)
    || value['conversationId'] !== conversationId
    || typeof sequence !== 'number'
    || !Number.isSafeInteger(sequence)
    || sequence < 1
    || value['eventId'] !== `${conversationId}:${sequence}`
    || typeof value['type'] !== 'string'
    || typeof value['timestamp'] !== 'string'
    || value['durable'] !== true
    || !optionalUuid(value['sessionId'])
    || !optionalUuid(value['turnId'])
    || (
      value['truncated'] !== undefined
      && typeof value['truncated'] !== 'boolean'
    )
  ) return false;
  return Object.hasOwn(value, 'payload');
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function optionalUuid(value: unknown): boolean {
  return value === undefined
    || (typeof value === 'string' && UUID_PATTERN.test(value));
}

function isAgentId(value: unknown): value is ConversationSession['agentId'] {
  return value === 'codex' || value === 'claude' || value === 'cursor'
    || value === 'trae';
}

function stringPayload(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function finiteTokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function finiteExitCode(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : null;
}

function readEvents(file: string, conversationId: string): DurableEvent[] {
  if (!fs.existsSync(file)) return [];
  let source: string;
  try {
    source = readPrivateFile(file);
  } catch {
    return [];
  }
  if (source && !source.endsWith('\n')) {
    const lastComplete = source.lastIndexOf('\n');
    fs.truncateSync(file, lastComplete < 0 ? 0 : lastComplete + 1);
  }
  const events = source.split('\n').filter(Boolean).flatMap((line) => {
    try {
      const event = JSON.parse(line) as unknown;
      return isDurableEvent(event, conversationId) ? [event] : [];
    } catch {
      return [];
    }
  });
  const monotonic: DurableEvent[] = [];
  for (const event of events) {
    if ((monotonic.at(-1)?.sequence ?? 0) < event.sequence) {
      monotonic.push(event);
    }
  }
  return monotonic;
}

function validateRestoredTurn(
  turn: unknown,
  conversationId: string,
  fileName: string,
  conversation: ConversationRecord,
): asserts turn is TurnRecord {
  if (
    !isRecord(turn) || !hasOnlyKeys(turn, TURN_KEYS)
    || typeof turn['id'] !== 'string' || !UUID_PATTERN.test(turn['id'])
    || fileName !== `${turn['id']}.json`
    || turn['conversationId'] !== conversationId
    || typeof turn['sessionId'] !== 'string'
    || !UUID_PATTERN.test(turn['sessionId'])
    || !conversation.sessions.some((session) =>
      session.id === turn['sessionId']
    )
    || typeof turn['prompt'] !== 'string'
    || Buffer.byteLength(turn['prompt']) > PROMPT_LIMIT
    || !isAgentId(turn['agentId'])
    || !optionalString(turn['model'])
    || !optionalString(turn['effort'])
    || typeof turn['requestHash'] !== 'string'
    || !isKnownTurnStatus(turn['status'])
    || typeof turn['acceptedAt'] !== 'string'
    || !optionalString(turn['startedAt'])
    || !optionalString(turn['completedAt'])
    || !optionalString(turn['revision'])
    || !optionalString(turn['error'])
    || (
      turn['warnings'] !== undefined
      && (!Array.isArray(turn['warnings'])
        || !turn['warnings'].every((warning) => typeof warning === 'string'))
    )
  ) {
    throw new Error(`Invalid turn record ${fileName}`);
  }
}

function isKnownTurnStatus(status: unknown): status is TurnRecord['status'] {
  return status === 'accepted' || status === 'starting' || status === 'running'
    || status === 'awaiting_approval' || status === 'cancelling'
    || status === 'completed' || status === 'failed' || status === 'cancelled'
    || status === 'interrupted';
}

function directorySize(root: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) total += directorySize(target);
    else if (entry.isFile()) total += fs.statSync(target).size;
  }
  return total;
}

function hasActiveTurn(conversation: LoadedConversation): boolean {
  return [...conversation.turns.values()].some((turn) =>
    isActiveStatus(turn.status)
  );
}

function isActiveStatus(status: TurnRecord['status']): boolean {
  return status === 'accepted' || status === 'starting' || status === 'running'
    || status === 'awaiting_approval' || status === 'cancelling';
}
