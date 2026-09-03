// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';

import type { PlaygroundStore } from './store.js';
import type {
  AgentAdapter,
  AgentDescriptor,
  AgentId,
  AgentModelCatalog,
  AgentModelOption,
  ApprovalRecord,
  RunningAgent,
  TurnRecord,
  TurnRequest,
} from './types.js';
import {
  DEFAULT_TURN_TIMEOUT_MS,
  PlaygroundError,
  VISIBLE_HISTORY_LIMIT,
} from './types.js';
import { buildLynxXmlSystemPrompt } from '../../../lynx-xml/dist/index.js';

interface ActiveTurn {
  conversationId: string;
  turnId: string;
  lease: symbol;
  running?: RunningAgent;
  terminal: boolean;
  deadline?: ReturnType<typeof setTimeout>;
  stop: Promise<void>;
  resolveStop: () => void;
  approvalRequests: Map<string, string>;
  approvalCallbacks: Map<
    string,
    Pick<PendingApproval, 'respond' | 'cancel'>
  >;
  deltaBatcher?: AssistantDeltaBatcher;
}

interface PendingApproval {
  conversationId: string;
  turnId: string;
  respond: (decision: ApprovalRecord['decision']) => void;
  cancel: () => void;
  decisions: readonly ApprovalRecord['decision'][];
}

export const ASSISTANT_DELTA_BATCH_BYTES: number = 16 * 1024;
export const ASSISTANT_DELTA_BATCH_MS: number = 50;

export class AssistantDeltaBatcher {
  private pending = '';
  private pendingBytes = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly emit: (text: string) => void) {}

  push(text: string): void {
    if (!text) return;
    this.pending += text;
    this.pendingBytes += Buffer.byteLength(text);
    while (this.pendingBytes >= ASSISTANT_DELTA_BATCH_BYTES) {
      const { head, tail } = takeUtf8Prefix(
        this.pending,
        ASSISTANT_DELTA_BATCH_BYTES,
      );
      if (!head) break;
      this.pending = tail;
      this.pendingBytes -= Buffer.byteLength(head);
      this.emit(head);
    }
    if (this.pending) this.schedule();
    else this.clearTimer();
  }

  flush(): void {
    this.clearTimer();
    if (!this.pending) return;
    const text = this.pending;
    this.pending = '';
    this.pendingBytes = 0;
    this.emit(text);
  }

  discard(): void {
    this.clearTimer();
    this.pending = '';
    this.pendingBytes = 0;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, ASSISTANT_DELTA_BATCH_MS);
    this.timer.unref();
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}

export class PlaygroundEngine {
  private active: ActiveTurn | undefined;
  private readonly pendingApprovals = new Map<string, PendingApproval>();
  private readonly resolvedApprovals = new Map<
    string,
    ApprovalRecord['decision']
  >();

  constructor(
    private readonly store: PlaygroundStore,
    private readonly adapters: Map<AgentId, AgentAdapter>,
    private readonly cwd: string = process.cwd(),
    private readonly turnTimeoutMs: number = DEFAULT_TURN_TIMEOUT_MS,
  ) {
    for (const conversation of store.list()) {
      for (const event of store.eventsAfter(conversation.id, 0)) {
        if (event.type !== 'approval.resolved' || !isRecord(event.payload)) {
          continue;
        }
        const requestId = event.payload['requestId'];
        const decision = event.payload['decision'];
        if (
          typeof requestId === 'string'
          && (decision === 'allow_once' || decision === 'deny')
        ) {
          this.resolvedApprovals.set(
            `${conversation.id}:${requestId}`,
            decision,
          );
        }
      }
    }
  }

  descriptors(): AgentDescriptor[] {
    return [...this.adapters.values()].map((adapter) => adapter.descriptor);
  }

  async modelCatalog(agentId: AgentId): Promise<AgentModelCatalog> {
    const adapter = this.requireUsableAdapter(agentId);
    if (!adapter.descriptor.capabilities.models) {
      return {
        status: 'unsupported',
        reason: 'agent-does-not-expose-model-list',
        models: [],
      };
    }
    return await this.readModelCatalog(adapter);
  }

  async submitTurn(
    conversationId: string,
    turnId: string,
    request: TurnRequest,
  ): Promise<{ created: boolean; turn: TurnRecord }> {
    const known = tryGetTurn(this.store, conversationId, turnId);
    if (known) {
      const accepted = this.store.acceptTurn(conversationId, turnId, request);
      return { created: false, turn: accepted.turn };
    }
    this.requireNoActiveTurn();
    const adapter = this.requireUsableAdapter(request.agentId);
    validateCapabilities(adapter, request);
    if (request.model) {
      await this.validateModelSelection(adapter, request.model, request.effort);
    }
    const concurrent = tryGetTurn(this.store, conversationId, turnId);
    if (concurrent) {
      const accepted = this.store.acceptTurn(conversationId, turnId, request);
      return { created: false, turn: accepted.turn };
    }
    this.requireNoActiveTurn();

    const accepted = this.store.acceptTurn(conversationId, turnId, request);
    let resolveStop!: () => void;
    const stop = new Promise<void>((resolve) => resolveStop = resolve);
    const active: ActiveTurn = {
      conversationId,
      turnId,
      lease: Symbol(turnId),
      terminal: false,
      stop,
      resolveStop,
      approvalRequests: new Map(),
      approvalCallbacks: new Map(),
    };
    this.active = active;
    active.deadline = setTimeout(
      () => this.timeout(active),
      this.turnTimeoutMs,
    );
    active.deadline.unref();
    void this.run(active, adapter, request);
    return { created: true, turn: accepted.turn };
  }

  private requireNoActiveTurn(): void {
    if (this.active) {
      throw new PlaygroundError(
        409,
        `Another turn is already active: ${this.active.turnId}`,
        'ACTIVE_TURN_EXISTS',
      );
    }
  }

  private requireUsableAdapter(agentId: AgentId): AgentAdapter {
    const adapter = this.adapters.get(agentId);
    if (!adapter) throw new PlaygroundError(400, 'Unknown agent');
    if (!adapter.descriptor.available) {
      throw new PlaygroundError(
        422,
        `${adapter.descriptor.name} is not available`,
        'AGENT_UNAVAILABLE',
      );
    }
    if (adapter.descriptor.authentication !== 'authenticated') {
      throw new PlaygroundError(
        422,
        `${adapter.descriptor.name} is not authenticated`,
        'AGENT_UNAUTHENTICATED',
      );
    }
    return adapter;
  }

  private async readModelCatalog(
    adapter: AgentAdapter,
    forceRefresh = false,
  ): Promise<AgentModelCatalog> {
    try {
      return await adapter.listModels(forceRefresh);
    } catch (error) {
      throw new PlaygroundError(
        502,
        `Could not load ${adapter.descriptor.name} models: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'MODEL_DISCOVERY_FAILED',
      );
    }
  }

  private async validateModelSelection(
    adapter: AgentAdapter,
    model: string,
    effort: string | undefined,
  ): Promise<void> {
    let catalog = await this.readModelCatalog(adapter);
    let option = findModel(catalog, model);
    if (!option) {
      catalog = await this.readModelCatalog(adapter, true);
      option = findModel(catalog, model);
    }
    if (!option) {
      throw new PlaygroundError(
        400,
        `${model} is not available for ${adapter.descriptor.name}`,
        'MODEL_NOT_AVAILABLE',
      );
    }
    if (
      effort && option.efforts !== undefined
      && !option.efforts.includes(effort)
    ) {
      throw new PlaygroundError(
        400,
        `${effort} is not available for ${option.label}`,
        'EFFORT_NOT_AVAILABLE',
      );
    }
  }

  cancel(conversationId: string, turnId: string): TurnRecord {
    const active = this.active;
    if (
      !active || active.conversationId !== conversationId
      || active.turnId !== turnId || active.terminal
    ) {
      const turn = this.store.getTurn(conversationId, turnId);
      if (isTerminal(turn.status)) return turn;
      throw new PlaygroundError(409, 'Turn is not active');
    }
    const cancellingTurn = this.store.updateTurn(conversationId, turnId, {
      status: 'cancelling',
    });
    this.store.releaseTurnEventLogBudget(turnId);
    this.store.emit(
      conversationId,
      'turn.cancelling',
      { turn: cancellingTurn },
      turnId,
    );
    return this.terminate(active, cancellingTurn, 'cancelled');
  }

  approve(
    conversationId: string,
    requestId: string,
    decision: ApprovalRecord['decision'],
  ): void {
    const approvalKey = `${conversationId}:${requestId}`;
    const resolved = this.resolvedApprovals.get(approvalKey);
    if (resolved) {
      if (resolved !== decision) {
        throw new PlaygroundError(
          409,
          'Conflicting approval decision',
          'ID_CONFLICT',
        );
      }
      return;
    }
    const pending = this.pendingApprovals.get(approvalKey);
    if (!pending || pending.conversationId !== conversationId) {
      throw new PlaygroundError(404, 'Approval request not found');
    }
    if (!pending.decisions.includes(decision)) {
      throw new PlaygroundError(400, 'Approval decision is not offered');
    }
    this.pendingApprovals.delete(approvalKey);
    this.resolvedApprovals.set(approvalKey, decision);
    this.store.emit(conversationId, 'approval.resolved', {
      requestId,
      decision,
    }, pending.turnId);
    this.store.updateTurn(conversationId, pending.turnId, {
      status: 'running',
    });
    pending.respond(decision);
  }

  async shutdown(): Promise<void> {
    const active = this.active;
    if (!active) return;
    if (!active.terminal) this.cancel(active.conversationId, active.turnId);
    await active.running?.close();
  }

  private async run(
    active: ActiveTurn,
    adapter: AgentAdapter,
    request: TurnRequest,
  ): Promise<void> {
    const { conversationId, turnId } = active;
    try {
      const startingTurn = this.store.updateTurn(conversationId, turnId, {
        status: 'starting',
        startedAt: new Date().toISOString(),
      });
      this.store.emit(
        conversationId,
        'turn.starting',
        { turn: startingTurn },
        turnId,
      );
      const running = adapter.launch({
        systemPrompt: buildLynxXmlSystemPrompt({
          appendix:
            'The final assistant response is the only authoritative artifact. Do not write files. Return only the complete Lynx XML document.',
        }),
        prompt: this.buildPrompt(conversationId, turnId, request),
        cwd: this.cwd,
        ...(request.model ? { model: request.model } : {}),
        ...(request.effort ? { effort: request.effort } : {}),
      });
      active.running = running;
      if (active.terminal) {
        running.cancel();
        return;
      }
      const startedTurn = this.store.updateTurn(conversationId, turnId, {
        status: 'running',
      });
      this.store.emit(
        conversationId,
        'turn.started',
        { turn: startedTurn },
        turnId,
      );
      const deltaBatcher = new AssistantDeltaBatcher((text) => {
        if (!this.hasLease(active)) return;
        this.store.emitTransient(conversationId, 'assistant.delta', {
          text,
        }, turnId);
      });
      active.deltaBatcher = deltaBatcher;
      let finalText: string | undefined;
      const iterator = running.events[Symbol.asyncIterator]();
      while (true) {
        const next = await Promise.race([
          iterator.next().then((result) => ({ result })),
          active.stop.then(() => ({ stopped: true as const })),
        ]);
        if ('stopped' in next) return;
        if (next.result.done) break;
        const event = next.result.value;
        if (!this.hasLease(active)) continue;
        if (event.type !== 'assistant_delta' && event.type !== 'error') {
          deltaBatcher.flush();
        }
        switch (event.type) {
          case 'assistant_delta':
            deltaBatcher.push(event.text);
            break;
          case 'assistant_final':
            finalText = event.text;
            break;
          case 'activity':
            this.store.emit(
              conversationId,
              'activity',
              { text: sanitizeVisibleText(event.text) },
              turnId,
            );
            break;
          case 'error':
            if (/policy|blocked|safety|permission/iu.test(event.message)) {
              this.store.emit(conversationId, 'policy.blocked', {
                reason: sanitizeVisibleText(event.message),
              }, turnId);
            }
            throw new Error(event.message);
          case 'tool':
            this.store.emit(
              conversationId,
              'tool',
              { name: event.name, status: event.status },
              turnId,
            );
            break;
          case 'usage':
            this.store.emit(conversationId, 'usage', {
              ...(event.inputTokens === undefined
                ? {}
                : { inputTokens: event.inputTokens }),
              ...(event.outputTokens === undefined
                ? {}
                : { outputTokens: event.outputTokens }),
            }, turnId);
            break;
          case 'policy_blocked':
            this.store.emit(conversationId, 'policy.blocked', {
              reason: sanitizeVisibleText(event.reason),
            }, turnId);
            break;
          case 'approval': {
            const existingRequestId = active.approvalRequests.get(
              event.requestId,
            );
            if (existingRequestId) {
              if (
                active.approvalCallbacks.get(event.requestId)?.respond
                  !== event.respond
              ) {
                throw new Error(
                  'Conflicting native approval identity: ' + event.requestId,
                );
              }
              break;
            }
            const requestId = randomUUID();
            active.approvalRequests.set(event.requestId, requestId);
            active.approvalCallbacks.set(event.requestId, {
              respond: event.respond,
              cancel: event.cancel,
            });
            this.store.updateTurn(conversationId, turnId, {
              status: 'awaiting_approval',
            });
            this.pendingApprovals.set(`${conversationId}:${requestId}`, {
              conversationId,
              turnId,
              respond: event.respond,
              cancel: event.cancel,
              decisions: event.decisions,
            });
            this.store.emit(conversationId, 'approval.requested', {
              requestId,
              prompt: sanitizeVisibleText(event.prompt),
              decisions: event.decisions,
            }, turnId);
            break;
          }
        }
        if (finalText !== undefined) break;
      }
      if (!this.hasLease(active)) return;
      if (!finalText) {
        throw new Error(
          'Agent returned no authoritative final assistant response',
        );
      }
      this.store.releaseTurnEventLogBudget(turnId);
      const revision = this.store.commitArtifact(
        conversationId,
        turnId,
        finalText,
      );
      if (!this.hasLease(active)) return;
      const artifact = this.store.readArtifact(conversationId, revision);
      const artifactHash = this.store.artifactHash(conversationId, revision);
      this.store.emit(conversationId, 'message.assistant', {
        summary: 'Assistant returned a validated Lynx XML artifact',
        bytes: Buffer.byteLength(artifact),
        sha256: artifactHash,
        format: 'lynx-xml',
      }, turnId);
      active.terminal = true;
      const completedTurn = this.store.updateTurn(conversationId, turnId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        revision,
      });
      this.store.releaseTurnEventLogBudget(turnId);
      this.store.emit(
        conversationId,
        'artifact.ready',
        { revision, hash: artifactHash },
        turnId,
      );
      this.store.emit(conversationId, 'turn.completed', {
        turn: completedTurn,
        revision,
      }, turnId);
    } catch (error) {
      if (!this.hasLease(active)) return;
      active.deltaBatcher?.discard();
      active.terminal = true;
      const message = error instanceof Error ? error.message : String(error);
      const failedTurn = this.store.updateTurn(conversationId, turnId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: message,
      });
      this.store.releaseTurnEventLogBudget(turnId);
      this.store.emit(conversationId, 'turn.failed', {
        turn: failedTurn,
        error: message,
      }, turnId);
    } finally {
      active.deltaBatcher?.discard();
      try {
        await active.running?.close();
        const processExit = await active.running?.exit;
        if (processExit) {
          this.store.emit(conversationId, 'process.exit', {
            code: processExit.code,
            signal: processExit.signal,
          }, turnId);
        }
      } finally {
        this.releaseActive(active);
      }
    }
  }

  private buildPrompt(
    conversationId: string,
    currentTurnId: string,
    request: TurnRequest,
  ): string {
    const { conversation, turns } = this.store.get(conversationId);
    const latestArtifact = conversation.latestRevision
      ? this.store.readArtifact(conversationId, conversation.latestRevision)
      : '';
    const historyEntries = turns.filter((turn, index) =>
      turn.id !== currentTurnId && index !== 0
    )
      .map((turn) => {
        const assistant = turn.revision
          ? this.store.readArtifact(conversationId, turn.revision)
          : `[${turn.status}${turn.error ? `: ${turn.error}` : ''}]`;
        return `User: ${turn.prompt}\nAssistant: ${assistant}`;
      });
    const { text: clippedHistory, truncated: historyTruncated, originalBytes } =
      selectVisibleHistory(historyEntries);
    if (historyTruncated) {
      this.store.emit(conversationId, 'context.truncated', {
        originalBytes,
        retainedBytes: VISIBLE_HISTORY_LIMIT,
      }, currentTurnId);
    }
    return [
      latestArtifact ? `Latest complete artifact:\n${latestArtifact}` : '',
      turns.length > 1 && conversation.initialRequest
        ? `Initial request:\n${conversation.initialRequest}`
        : '',
      clippedHistory
        ? `Visible user/assistant history (thinking/tools/approvals excluded):\n${clippedHistory}`
        : '',
      `Current request:\n${request.prompt}`,
    ].filter(Boolean).join('\n\n');
  }

  private hasLease(active: ActiveTurn): boolean {
    return this.active?.lease === active.lease && !active.terminal;
  }

  private releaseActive(active: ActiveTurn): void {
    if (active.deadline) clearTimeout(active.deadline);
    active.deltaBatcher?.discard();
    this.clearPendingApprovals(active, false);
    this.store.releaseTurnEventLogBudget(active.turnId);
    if (this.active?.lease === active.lease) this.active = undefined;
  }

  private clearPendingApprovals(
    active: ActiveTurn,
    cancelTransport: boolean,
  ): void {
    for (const [requestId, approval] of this.pendingApprovals) {
      if (approval.turnId === active.turnId) {
        if (cancelTransport) approval.cancel();
        this.pendingApprovals.delete(requestId);
      }
    }
  }

  private timeout(active: ActiveTurn): void {
    if (!this.hasLease(active)) return;
    const turn = this.store.updateTurn(active.conversationId, active.turnId, {
      status: 'cancelling',
    });
    this.store.releaseTurnEventLogBudget(active.turnId);
    this.store.emit(active.conversationId, 'turn.cancelling', {
      turn,
      reason: 'deadline',
    }, active.turnId);
    this.terminate(
      active,
      turn,
      'failed',
      `Turn exceeded the ${this.turnTimeoutMs} ms deadline`,
    );
  }

  private terminate(
    active: ActiveTurn,
    turn: TurnRecord,
    status: 'cancelled' | 'failed',
    error?: string,
  ): TurnRecord {
    active.deltaBatcher?.discard();
    active.terminal = true;
    active.resolveStop();
    if (active.deadline) clearTimeout(active.deadline);
    this.clearPendingApprovals(active, true);
    active.running?.cancel();
    this.store.releaseTurnEventLogBudget(active.turnId);
    turn = this.store.updateTurn(active.conversationId, active.turnId, {
      status,
      completedAt: new Date().toISOString(),
      ...(error ? { error } : {}),
    });
    this.store.emit(
      active.conversationId,
      status === 'cancelled' ? 'turn.cancelled' : 'turn.failed',
      { turn, ...(error ? { error } : {}) },
      active.turnId,
    );
    return turn;
  }
}

function takeUtf8Prefix(
  value: string,
  maximumBytes: number,
): { head: string; tail: string } {
  let bytes = 0;
  let index = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maximumBytes) break;
    bytes += characterBytes;
    index += character.length;
  }
  return { head: value.slice(0, index), tail: value.slice(index) };
}

function validateCapabilities(
  adapter: AgentAdapter,
  request: TurnRequest,
): void {
  if (!adapter.descriptor.available) {
    throw new PlaygroundError(
      422,
      `${adapter.descriptor.name} is not available`,
      'AGENT_UNAVAILABLE',
    );
  }
  if (adapter.descriptor.authentication !== 'authenticated') {
    throw new PlaygroundError(
      422,
      `${adapter.descriptor.name} is not authenticated`,
      'AGENT_UNAUTHENTICATED',
    );
  }
  if (request.model && !adapter.descriptor.capabilities.models) {
    throw new PlaygroundError(
      400,
      `${adapter.descriptor.name} does not expose model selection`,
    );
  }
  if (request.effort && !adapter.descriptor.capabilities.effort) {
    throw new PlaygroundError(
      400,
      `${adapter.descriptor.name} does not expose effort selection`,
    );
  }
}

function findModel(
  catalog: AgentModelCatalog,
  model: string,
): AgentModelOption | undefined {
  return catalog.status === 'ready'
    ? catalog.models.find((option) => option.value === model)
    : undefined;
}

function tryGetTurn(
  store: PlaygroundStore,
  conversationId: string,
  turnId: string,
): TurnRecord | undefined {
  try {
    return store.getTurn(conversationId, turnId);
  } catch (error) {
    if (error instanceof PlaygroundError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
    || status === 'interrupted';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeVisibleText(value: string): string {
  return value.slice(0, 4_096)
    .replace(
      /(api[_-]?key|token|secret|authorization)(\s*[:=]\s*)[^\s,;]+/giu,
      '$1$2[redacted]',
    );
}

function selectVisibleHistory(entries: readonly string[]): {
  text: string;
  truncated: boolean;
  originalBytes: number;
} {
  const originalBytes = Buffer.byteLength(entries.join('\n\n'));
  const selected: string[] = [];
  let bytes = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    const separatorBytes = selected.length > 0 ? 2 : 0;
    const entryBytes = Buffer.byteLength(entry);
    if (bytes + separatorBytes + entryBytes > VISIBLE_HISTORY_LIMIT) break;
    selected.unshift(entry);
    bytes += separatorBytes + entryBytes;
  }
  return {
    text: selected.join('\n\n'),
    truncated: bytes < originalBytes,
    originalBytes,
  };
}
