// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  AgentAdapter,
  AgentCapabilities,
  AgentDescriptor,
  AgentEvent,
  AgentId,
  AgentLaunchRequest,
  AgentModelCatalog,
  AgentModelOption,
  RunningAgent,
} from './types.js';
import {
  AGENT_EVENT_QUEUE_BYTES_LIMIT,
  AGENT_EVENT_QUEUE_COUNT_LIMIT,
  ARTIFACT_LIMIT,
  PROTOCOL_FRAME_BYTES_LIMIT,
} from './types.js';

interface AdapterProfile {
  id: AgentId;
  name: string;
  command: readonly string[];
  protocol: AgentDescriptor['protocol'];
  capabilities: AgentCapabilities;
  efforts?: readonly string[];
}

const ACP_CAPABILITIES: AgentCapabilities = {
  models: false,
  effort: false,
  tools: true,
  approvals: true,
  cancellation: true,
};
const JSON_RPC_REQUEST_ID_LIMIT = 2_048;
const MODEL_CATALOG_TTL_MS = 60_000;
const MODEL_DISCOVERY_TIMEOUT_MS = 10_000;
const MODEL_DISCOVERY_OUTPUT_LIMIT = 1024 * 1024;
const MODEL_DISCOVERY_OPTION_LIMIT = 256;
const UNSUPPORTED_MODEL_CATALOG: AgentModelCatalog = {
  status: 'unsupported',
  reason: 'agent-does-not-expose-model-list',
  models: [],
};

export const ADAPTER_PROFILES: readonly AdapterProfile[] = [
  {
    id: 'codex',
    name: 'Codex',
    command: ['codex', 'app-server', '--stdio'],
    protocol: 'codex-app-server',
    capabilities: {
      models: true,
      effort: true,
      tools: true,
      approvals: true,
      cancellation: true,
    },
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
  {
    id: 'claude',
    name: 'Claude Code',
    command: [
      'claude',
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
    ],
    protocol: 'claude-stream-json',
    capabilities: {
      models: false,
      effort: true,
      tools: true,
      approvals: false,
      cancellation: true,
    },
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    command: ['cursor-agent', 'acp'],
    protocol: 'acp',
    capabilities: { ...ACP_CAPABILITIES, models: true },
  },
  {
    id: 'trae',
    name: 'Trae',
    command: ['traecli', 'acp', 'serve'],
    protocol: 'acp',
    capabilities: { ...ACP_CAPABILITIES, models: true },
  },
] as const;

export function createAgentAdapters(
  _cwd: string,
  environment: NodeJS.ProcessEnv = process.env,
): Map<AgentId, AgentAdapter> {
  if (process.platform !== 'darwin') {
    throw new Error('GenUI playground currently supports macOS only');
  }
  return new Map(ADAPTER_PROFILES.map((profile) => {
    const executable = resolveExecutable(
      profile.command[0]!,
      environment['PATH'],
    );
    const authentication = executable
      ? detectAuthentication(profile.id, executable, environment)
      : 'unavailable';
    const capabilities = { ...profile.capabilities };
    const descriptor: AgentDescriptor = {
      ...profile,
      available: executable !== null,
      authentication,
      efforts: capabilities.effort ? profile.efforts ?? [] : [],
      capabilities,
    };
    const listModels = createModelCatalogLoader(
      profile,
      executable,
      environment,
    );
    return [profile.id, {
      descriptor,
      listModels,
      launch(request: AgentLaunchRequest): RunningAgent {
        if (!executable) {
          throw new Error(`${profile.name} is not installed or not on PATH`);
        }
        const command = buildLaunchCommand(profile, executable, request);
        if (profile.id === 'claude') {
          command.push(
            '--append-system-prompt',
            request.systemPrompt,
            '--include-partial-messages',
          );
          if (request.effort) command.push('--effort', request.effort);
        }
        return launchProtocolProcess(
          profile,
          command,
          request,
          request.cwd,
          environment,
        );
      },
    }];
  }));
}

export function resolveExecutable(
  command: string,
  pathValue: string | undefined = process.env['PATH'],
): string | null {
  if (command.includes(path.sep)) {
    return isExecutable(command) ? path.resolve(command) : null;
  }
  for (const directory of (pathValue ?? '').split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function detectAuthentication(
  agentId: AgentId,
  executable: string,
  environment: NodeJS.ProcessEnv,
): AgentDescriptor['authentication'] {
  const argumentsByAgent: Partial<Record<AgentId, readonly string[]>> = {
    codex: ['login', 'status'],
    claude: ['auth', 'status'],
    cursor: ['status'],
    trae: ['login', 'status'],
  };
  const args = argumentsByAgent[agentId];
  if (!args) return 'unknown';
  const result = spawnSync(executable, args, {
    env: environment,
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0) return 'unknown';
  if (
    /not logged in|not authenticated|unauthenticated|logged out/iu.test(output)
  ) {
    return 'unknown';
  }
  return 'authenticated';
}

function buildLaunchCommand(
  profile: AdapterProfile,
  executable: string,
  request: AgentLaunchRequest,
): string[] {
  if (request.model && profile.id === 'cursor') {
    return [executable, '--model', request.model, ...profile.command.slice(1)];
  }
  if (request.model && profile.id === 'trae') {
    return [executable, '-m', request.model, ...profile.command.slice(1)];
  }
  return [executable, ...profile.command.slice(1)];
}

function createModelCatalogLoader(
  profile: AdapterProfile,
  executable: string | null,
  environment: NodeJS.ProcessEnv,
): (forceRefresh?: boolean) => Promise<AgentModelCatalog> {
  let cached:
    | { catalog: AgentModelCatalog; expiresAt: number }
    | undefined;
  let pending: Promise<AgentModelCatalog> | undefined;
  return async (forceRefresh = false): Promise<AgentModelCatalog> => {
    if (!profile.capabilities.models) return UNSUPPORTED_MODEL_CATALOG;
    if (!executable) {
      throw new Error(`${profile.name} is not installed or not on PATH`);
    }
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return cached.catalog;
    }
    if (pending) return await pending;
    pending = discoverModels(profile.id, executable, environment).then(
      (catalog) => {
        cached = {
          catalog,
          expiresAt: Date.now() + MODEL_CATALOG_TTL_MS,
        };
        return catalog;
      },
    ).finally(() => pending = undefined);
    return await pending;
  };
}

async function discoverModels(
  agentId: AgentId,
  executable: string,
  environment: NodeJS.ProcessEnv,
): Promise<AgentModelCatalog> {
  let models: AgentModelOption[];
  if (agentId === 'codex') {
    models = await discoverCodexModels(executable, environment);
  } else if (agentId === 'cursor') {
    models = parseCursorModels(
      await runModelCommand(
        executable,
        ['--list-models'],
        environment,
      ),
    );
  } else if (agentId === 'trae') {
    const output = await runModelCommand(
      executable,
      ['models', '--json'],
      environment,
    );
    try {
      models = parseTraeModels(JSON.parse(output) as unknown);
    } catch (error) {
      throw new Error('Trae returned an invalid model catalog', {
        cause: error,
      });
    }
  } else {
    return UNSUPPORTED_MODEL_CATALOG;
  }
  if (models.length === 0) {
    throw new Error('Agent returned an empty model catalog');
  }
  return {
    status: 'ready',
    models: deduplicateModels(models).slice(0, MODEL_DISCOVERY_OPTION_LIMIT),
  };
}

async function discoverCodexModels(
  executable: string,
  environment: NodeJS.ProcessEnv,
): Promise<AgentModelOption[]> {
  const child = spawn(executable, ['app-server', '--stdio'], {
    env: environment,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const decoder = new JsonMessageDecoder();
  const models: AgentModelOption[] = [];
  let outputBytes = 0;
  let requestId = 2;
  let settled = false;
  return await new Promise<AgentModelOption[]>((resolve, reject) => {
    const timer = setTimeout(
      () => fail(new Error('Codex model discovery timed out')),
      MODEL_DISCOVERY_TIMEOUT_MS,
    );
    timer.unref();
    const cleanup = (): void => clearTimeout(timer);
    const stop = async (): Promise<void> => {
      child.stdin.end();
      await terminateProcessGroup(child);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      void stop().finally(() => reject(error));
    };
    const succeed = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      const result = deduplicateModels(models).slice(
        0,
        MODEL_DISCOVERY_OPTION_LIMIT,
      );
      void stop().then(() => resolve(result), reject);
    };
    const write = (message: unknown): void => {
      if (!child.stdin.destroyed) {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      }
    };
    const requestPage = (cursor?: string): void => {
      write({
        jsonrpc: '2.0',
        id: requestId,
        method: 'model/list',
        params: {
          includeHidden: false,
          limit: 100,
          ...(cursor ? { cursor } : {}),
        },
      });
    };
    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) return;
      outputBytes += chunk.length;
      if (outputBytes > MODEL_DISCOVERY_OUTPUT_LIMIT) {
        fail(new Error('Codex model catalog output exceeded 1 MiB'));
        return;
      }
      try {
        for (const decoded of decoder.push(chunk)) {
          if (!isRecord(decoded)) continue;
          const message = decoded;
          const { error: messageError, id: messageId, result } = message;
          if (messageError !== undefined && messageId !== undefined) {
            fail(new Error('Codex rejected model discovery'));
            return;
          }
          if (messageId === 1) {
            write({ jsonrpc: '2.0', method: 'initialized', params: {} });
            requestPage();
            continue;
          }
          if (messageId !== requestId) continue;
          const page = parseCodexModelPage(result);
          models.push(...page.models);
          if (
            page.nextCursor
            && models.length < MODEL_DISCOVERY_OPTION_LIMIT
          ) {
            requestId += 1;
            requestPage(page.nextCursor);
          } else {
            succeed();
          }
        }
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MODEL_DISCOVERY_OUTPUT_LIMIT) {
        fail(new Error('Codex model catalog output exceeded 1 MiB'));
      }
    });
    child.once('error', fail);
    child.once('close', (code) => {
      if (!settled) {
        fail(new Error(`Codex model discovery exited with code ${code}`));
      }
    });
    write({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'lynx-genui-playground', version: '1' } },
    });
  });
}

async function runModelCommand(
  executable: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  const child = spawn(executable, args, {
    env: environment,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdin.end();
  let stdout = '';
  let stderr = '';
  let outputBytes = 0;
  let settled = false;
  return await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      fail(new Error('Model discovery timed out'));
    }, MODEL_DISCOVERY_TIMEOUT_MS);
    timer.unref();
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void terminateProcessGroup(child).finally(() => reject(error));
    };
    const append = (chunk: Buffer, target: 'stdout' | 'stderr'): void => {
      if (settled) return;
      outputBytes += chunk.length;
      if (outputBytes > MODEL_DISCOVERY_OUTPUT_LIMIT) {
        fail(new Error('Model catalog output exceeded 1 MiB'));
        return;
      }
      if (target === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };
    child.stdout.on('data', (chunk: Buffer) => append(chunk, 'stdout'));
    child.stderr.on('data', (chunk: Buffer) => append(chunk, 'stderr'));
    child.once('error', fail);
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void terminateProcessGroup(child).then(() => {
        if (code === 0 && stdout.trim()) {
          resolve(stdout);
          return;
        }
        const detail = stderr.trim().slice(0, 512);
        reject(
          new Error(
            `Model discovery exited with code ${code}${
              detail ? `: ${detail}` : ''
            }`,
          ),
        );
      }, reject);
    });
  });
}

export function parseCursorModels(output: string): AgentModelOption[] {
  const models: AgentModelOption[] = [];
  for (const source of output.split(/\r?\n/u)) {
    const line = source.trim();
    const separator = line.indexOf(' - ');
    if (separator <= 0) continue;
    const value = line.slice(0, separator).trim();
    const label = line.slice(separator + 3).trim();
    if (!value || /\s/u.test(value) || !label) continue;
    models.push({ value, label });
  }
  return deduplicateModels(models);
}

export function parseTraeModels(value: unknown): AgentModelOption[] {
  const source = isRecord(value) && Array.isArray(value['models'])
    ? value['models']
    : value;
  if (!Array.isArray(source)) return [];
  return deduplicateModels(source.flatMap((entry): AgentModelOption[] => {
    if (typeof entry === 'string') return [{ value: entry, label: entry }];
    if (!isRecord(entry)) return [];
    const name = stringValue(entry.name);
    const model = stringValue(entry['config_name']) || name;
    return model ? [{ value: model, label: name || model }] : [];
  }));
}

export function parseCodexModelPage(value: unknown): {
  models: AgentModelOption[];
  nextCursor?: string;
} {
  if (!isRecord(value)) {
    throw new Error('Codex returned an invalid model catalog page');
  }
  const { data, nextCursor: rawNextCursor } = value;
  if (!Array.isArray(data)) {
    throw new Error('Codex returned an invalid model catalog page');
  }
  const models = data.flatMap((entry): AgentModelOption[] => {
    if (!isRecord(entry)) return [];
    const {
      hidden,
      model: rawModel,
      id,
      supportedReasoningEfforts,
      displayName,
    } = entry;
    if (hidden === true) return [];
    const model = stringValue(rawModel) || stringValue(id);
    if (!model) return [];
    const efforts = Array.isArray(supportedReasoningEfforts)
      ? supportedReasoningEfforts.flatMap((option): string[] => {
        if (!isRecord(option)) return [];
        const { reasoningEffort } = option;
        const effort = stringValue(reasoningEffort);
        return effort ? [effort] : [];
      })
      : [];
    return [{
      value: model,
      label: stringValue(displayName) || model,
      efforts: [...new Set(efforts)],
    }];
  });
  const nextCursor = stringValue(rawNextCursor);
  return {
    models: deduplicateModels(models),
    ...(nextCursor ? { nextCursor } : {}),
  };
}

function deduplicateModels(
  models: readonly AgentModelOption[],
): AgentModelOption[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (!model.value || seen.has(model.value)) return false;
    seen.add(model.value);
    return true;
  });
}

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

export class AsyncEventQueue implements AsyncIterable<AgentEvent> {
  private readonly values: AgentEvent[] = [];
  private readonly waiters: Array<(value: IteratorResult<AgentEvent>) => void> =
    [];
  private ended = false;
  private queuedBytes = 0;

  push(value: AgentEvent): void {
    if (this.ended) return;
    const size = Buffer.byteLength(JSON.stringify(value));
    const nextCount = this.values.length + 1;
    const nextBytes = this.queuedBytes + size;
    if (
      nextCount > AGENT_EVENT_QUEUE_COUNT_LIMIT
      || nextBytes > AGENT_EVENT_QUEUE_BYTES_LIMIT
    ) {
      this.values.length = 0;
      this.queuedBytes = 0;
      const overflow: AgentEvent = {
        type: 'error',
        message:
          `Agent event queue limit exceeded: ${nextCount} events / ${nextBytes} bytes (limits: ${AGENT_EVENT_QUEUE_COUNT_LIMIT} events / ${AGENT_EVENT_QUEUE_BYTES_LIMIT} bytes)`,
      };
      const waiter = this.waiters.shift();
      if (waiter) waiter({ done: false, value: overflow });
      else {
        this.values.push(overflow);
        this.queuedBytes = Buffer.byteLength(JSON.stringify(overflow));
      }
      this.ended = true;
      for (const remaining of this.waiters.splice(0)) {
        remaining({ done: true, value: undefined });
      }
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) waiter({ done: false, value });
    else {
      this.values.push(value);
      this.queuedBytes += size;
    }
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter({ done: true, value: undefined });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<AgentEvent> {
    return {
      next: () => {
        const value = this.values.shift();
        if (value) {
          this.queuedBytes -= Buffer.byteLength(JSON.stringify(value));
          return Promise.resolve({ done: false, value });
        }
        if (this.ended) {
          return Promise.resolve({ done: true, value: undefined });
        }
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

export class JsonMessageDecoder {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer | string): unknown[] {
    this.buffer = Buffer.concat([
      this.buffer,
      typeof chunk === 'string' ? Buffer.from(chunk) : chunk,
    ]);
    const messages: unknown[] = [];
    while (this.buffer.length > 0) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (
        headerEnd >= 0
        && this.buffer.subarray(0, headerEnd).toString().includes(
          'Content-Length:',
        )
      ) {
        const header = this.buffer.subarray(0, headerEnd).toString('ascii');
        const match = /(?:^|\r\n)Content-Length:\s*(\d+)/iu.exec(header);
        if (!match) {
          this.buffer = this.buffer.subarray(headerEnd + 4);
          continue;
        }
        const length = Number(match[1]);
        if (length > PROTOCOL_FRAME_BYTES_LIMIT) {
          this.failFrameLimit(length);
        }
        const bodyStart = headerEnd + 4;
        if (this.buffer.length < bodyStart + length) break;
        const body = this.buffer.subarray(bodyStart, bodyStart + length)
          .toString('utf8');
        this.buffer = this.buffer.subarray(bodyStart + length);
        messages.push(parseJson(body));
        continue;
      }

      const newline = this.buffer.indexOf(0x0a);
      if (newline < 0) {
        if (this.buffer.length > PROTOCOL_FRAME_BYTES_LIMIT) {
          this.failFrameLimit(this.buffer.length);
        }
        break;
      }
      if (newline > PROTOCOL_FRAME_BYTES_LIMIT) {
        this.failFrameLimit(newline);
      }
      const line = this.buffer.subarray(0, newline).toString('utf8').trim();
      this.buffer = this.buffer.subarray(newline + 1);
      if (line) messages.push(parseJson(line));
    }
    return messages;
  }

  private failFrameLimit(observedBytes: number): never {
    this.buffer = Buffer.alloc(0);
    throw new Error(
      `Agent protocol frame limit exceeded: ${observedBytes} bytes (limit: ${PROTOCOL_FRAME_BYTES_LIMIT} bytes)`,
    );
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { __malformed: value.slice(0, 4_096) };
  }
}

class ProtocolReducer {
  private terminal = false;
  private assistant = '';
  private completedAssistant = '';
  private lastSequence = -1;
  private readonly seen = new Set<string>();
  private readonly jsonRpcRequests = new Map<string, string>();

  constructor(
    private readonly profile: AdapterProfile,
    private readonly write: (message: unknown) => void,
    private readonly onResponse: (message: JsonRecord) => void,
  ) {}

  accept(message: unknown): AgentEvent[] {
    if (this.terminal) return [];
    if (!isRecord(message)) {
      return [{
        type: 'activity',
        text: 'Ignored a non-object protocol event',
      }];
    }
    if (typeof message.__malformed === 'string') {
      return [{
        type: 'activity',
        text: 'Ignored malformed agent protocol output',
      }];
    }
    const requestIdentity = jsonRpcRequestIdentity(message);
    if (requestIdentity) {
      const prior = this.jsonRpcRequests.get(requestIdentity.id);
      if (prior === requestIdentity.payload) return [];
      if (prior !== undefined) {
        this.terminal = true;
        return [{
          type: 'error',
          message:
            `Conflicting JSON-RPC request id reuse: ${requestIdentity.id}`,
        }];
      }
      if (this.jsonRpcRequests.size >= JSON_RPC_REQUEST_ID_LIMIT) {
        this.terminal = true;
        return [{
          type: 'error',
          message:
            `JSON-RPC request ID capacity exceeded (${JSON_RPC_REQUEST_ID_LIMIT})`,
        }];
      }
      this.jsonRpcRequests.set(requestIdentity.id, requestIdentity.payload);
    }
    const sequence = protocolSequence(message);
    if (sequence !== undefined) {
      if (sequence <= this.lastSequence) return [];
      this.lastSequence = sequence;
    }
    const fingerprint = eventFingerprint(message);
    if (fingerprint && this.seen.has(fingerprint)) return [];
    if (fingerprint) this.seen.add(fingerprint);
    if (message.error !== undefined && this.isHandshakeResponse(message.id)) {
      const error = isRecord(message.error) ? message.error : {};
      this.terminal = true;
      return [{
        type: 'error',
        message: stringValue(error.message) || 'Agent protocol request failed',
      }];
    }
    if (message.id === 1 && isRecord(message.result)) {
      const conflict = capabilityConflict(this.profile, message.result);
      if (conflict) {
        this.terminal = true;
        return [{ type: 'error', message: conflict }];
      }
    }

    if (this.profile.protocol === 'claude-stream-json') {
      return this.acceptClaude(message);
    }
    if (this.profile.protocol === 'codex-app-server') {
      return this.acceptCodex(message);
    }
    return this.acceptAcp(message);
  }

  fail(message: string): AgentEvent[] {
    if (this.terminal) return [];
    this.terminal = true;
    return [{ type: 'error', message: `Agent process failed: ${message}` }];
  }

  finishFromExit(): AgentEvent[] {
    if (this.terminal) return [];
    this.terminal = true;
    return [{
      type: 'error',
      message: 'Agent exited without a protocol terminal response',
    }];
  }

  private isHandshakeResponse(id: unknown): boolean {
    return id === 1 || id === 2 || id === 3;
  }

  private acceptClaude(message: JsonRecord): AgentEvent[] {
    if (message.type === 'system' && message.subtype === 'init') {
      return [{ type: 'activity', text: 'Claude session initialized' }];
    }
    if (message.type === 'assistant' && isRecord(message.message)) {
      const text = contentText(message.message.content);
      if (!text) return toolEventsFromContent(message.message.content);
      this.assistant = text;
      if (Buffer.byteLength(this.assistant) > ARTIFACT_LIMIT) {
        this.terminal = true;
        return [{
          type: 'error',
          message: 'Agent output exceeds the 2 MiB artifact limit',
        }];
      }
      return [{ type: 'assistant_delta', text }];
    }
    if (message.type === 'stream_event' && isRecord(message.event)) {
      const event = message.event;
      if (event.type === 'content_block_delta' && isRecord(event.delta)) {
        const text = stringValue(event.delta.text);
        if (text) {
          this.assistant += text;
          if (Buffer.byteLength(this.assistant) > ARTIFACT_LIMIT) {
            this.terminal = true;
            return [{
              type: 'error',
              message: 'Agent output exceeds the 2 MiB artifact limit',
            }];
          }
          return [{ type: 'assistant_delta', text }];
        }
      }
      return [];
    }
    if (message.type === 'result') {
      this.terminal = true;
      const final = stringValue(message.result) || this.assistant;
      const usage = usageEvent(message['usage']);
      return final
        ? [...(usage ? [usage] : []), { type: 'assistant_final', text: final }]
        : [...(usage ? [usage] : []), {
          type: 'error',
          message: 'Claude returned no final assistant response',
        }];
    }
    return [];
  }

  private acceptCodex(message: JsonRecord): AgentEvent[] {
    const method = stringValue(message.method);
    const params = isRecord(message.params) ? message.params : {};
    if (message.id === 1 && isRecord(message.result)) {
      this.onResponse(message);
      return [];
    }
    if (message.id === 2 && isRecord(message.result)) {
      this.onResponse(message);
      return [];
    }
    if (message.id === 3 && isRecord(message.result)) {
      this.onResponse(message);
      return [];
    }
    if (method.endsWith('/delta')) {
      const text = stringValue(params.delta) || stringValue(params.text);
      if (text) {
        this.assistant += text;
        if (Buffer.byteLength(this.assistant) > ARTIFACT_LIMIT) {
          this.terminal = true;
          return [{
            type: 'error',
            message: 'Agent output exceeds the 2 MiB artifact limit',
          }];
        }
        return [{ type: 'assistant_delta', text }];
      }
    }
    if (method === 'item/completed' && isRecord(params.item)) {
      const item = params.item;
      if (item.type === 'agent_message' || item.type === 'agentMessage') {
        this.completedAssistant = stringValue(item.text)
          || contentText(item.content)
          || this.assistant;
      }
      if (
        item.type === 'commandExecution' || item.type === 'command_execution'
        || item.type === 'mcpToolCall' || item.type === 'mcp_tool_call'
      ) {
        return [{
          type: 'tool',
          name: stringValue(item.command) || stringValue(item.name) || 'tool',
          status: stringValue(item.status) || 'completed',
        }];
      }
    }
    if (method.includes('requestApproval') && message.id !== undefined) {
      return [this.approvalEvent(message.id, params)];
    }
    if (method === 'turn/completed') {
      const turn = isRecord(params['turn']) ? params['turn'] : {};
      const status = stringValue(turn.status);
      this.terminal = true;
      if (status && status !== 'completed') {
        const error = isRecord(turn.error) ? turn.error : {};
        return [{
          type: 'error',
          message: stringValue(error.message) || `Codex turn ${status}`,
        }];
      }
      const final = this.completedAssistant || this.assistant;
      const usage = usageEvent(turn['usage'] ?? params['usage']);
      return final
        ? [...(usage ? [usage] : []), { type: 'assistant_final', text: final }]
        : [...(usage ? [usage] : []), {
          type: 'error',
          message: 'Codex returned no final assistant response',
        }];
    }
    if (method === 'turn/failed') {
      this.terminal = true;
      const messageText = stringValue(params.message) || 'unknown error';
      if (/policy|blocked|safety|permission/iu.test(messageText)) {
        return [{ type: 'policy_blocked', reason: messageText }, {
          type: 'error',
          message: `Codex turn failed: ${messageText}`,
        }];
      }
      return [{
        type: 'error',
        message: `Codex turn failed: ${messageText}`,
      }];
    }
    return [];
  }

  private acceptAcp(message: JsonRecord): AgentEvent[] {
    if (message.id === 1 && isRecord(message.result)) {
      this.onResponse(message);
      return [];
    }
    if (message.id === 2 && isRecord(message.result)) {
      this.onResponse(message);
      return [];
    }
    if (message.method === 'session/update' && isRecord(message.params)) {
      const update = isRecord(message.params.update)
        ? message.params.update
        : message.params;
      const kind = stringValue(update.sessionUpdate)
        || stringValue(update.type);
      if (kind === 'agent_message_chunk' || kind === 'agentMessageChunk') {
        const text = contentText(update.content) || stringValue(update.text);
        if (text) {
          this.assistant += text;
          if (Buffer.byteLength(this.assistant) > ARTIFACT_LIMIT) {
            this.terminal = true;
            return [{
              type: 'error',
              message: 'Agent output exceeds the 2 MiB artifact limit',
            }];
          }
          return [{ type: 'assistant_delta', text }];
        }
      }
      if (kind.includes('tool_call')) {
        return [{
          type: 'tool',
          name: stringValue(update.title) || stringValue(update.name) || 'tool',
          status: stringValue(update.status) || 'running',
          ...(stringValue(update.content)
            ? { detail: stringValue(update.content) }
            : {}),
        }];
      }
      if (kind === 'agent_thought_chunk' || kind === 'plan') {
        return [{ type: 'activity', text: 'Agent is working…' }];
      }
      if (
        kind === 'idle'
        && stringValue(update.stopReason ?? update.stop_reason)
            .toLowerCase() === 'cancelled'
      ) {
        return [{ type: 'activity', text: 'Agent acknowledged cancellation' }];
      }
    }
    if (
      message.method === 'session/request_permission'
      && message.id !== undefined
    ) {
      return [
        this.approvalEvent(
          message.id,
          isRecord(message.params) ? message.params : {},
        ),
      ];
    }
    if (message.id === 3 && message.result !== undefined) {
      this.terminal = true;
      const usage = isRecord(message.result)
        ? usageEvent(message.result['usage'])
        : undefined;
      return this.assistant
        ? [...(usage ? [usage] : []), {
          type: 'assistant_final',
          text: this.assistant,
        }]
        : [...(usage ? [usage] : []), {
          type: 'error',
          message: 'ACP agent returned no final assistant response',
        }];
    }
    return [];
  }

  private approvalEvent(id: unknown, params: JsonRecord): AgentEvent {
    const requestId = jsonRpcIdKey(id);
    const isCodex = this.profile.protocol === 'codex-app-server';
    const allowOption = isCodex ? undefined : acpAllowOption(params);
    return {
      type: 'approval',
      requestId,
      prompt: stringValue(params.title) || stringValue(params.reason)
        || 'Agent requests permission',
      decisions: allowOption || isCodex
        ? ['allow_once', 'deny']
        : ['deny'],
      respond: (decision) => {
        if (decision === 'allow_once' && !isCodex && !allowOption) {
          throw new Error('ACP Agent did not offer an allow-once option');
        }
        this.write({
          jsonrpc: '2.0',
          id,
          result: isCodex
            ? { decision: decision === 'allow_once' ? 'accept' : 'decline' }
            : (decision === 'allow_once'
              ? {
                outcome: {
                  outcome: 'selected',
                  optionId: allowOption,
                },
              }
              : { outcome: { outcome: 'cancelled' } }),
        });
      },
      cancel: () => {
        this.write(
          isCodex
            ? {
              jsonrpc: '2.0',
              id,
              error: { code: -32_800, message: 'Request cancelled' },
            }
            : {
              jsonrpc: '2.0',
              id,
              result: { outcome: { outcome: 'cancelled' } },
            },
        );
      },
    };
  }
}

function usageEvent(value: unknown): AgentEvent | undefined {
  if (!isRecord(value)) return undefined;
  const inputTokens = finiteNumber(
    value['input_tokens'] ?? value['inputTokens'] ?? value['prompt_tokens'],
  );
  const outputTokens = finiteNumber(
    value['output_tokens'] ?? value['outputTokens']
      ?? value['completion_tokens'],
  );
  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  return {
    type: 'usage',
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function launchProtocolProcess(
  profile: AdapterProfile,
  command: readonly string[],
  request: AgentLaunchRequest,
  cwd: string,
  environment: NodeJS.ProcessEnv,
): RunningAgent {
  const child = spawn(command[0]!, command.slice(1), {
    cwd,
    env: environment,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const queue = new AsyncEventQueue();
  const decoder = new JsonMessageDecoder();
  let termination: Promise<void> | undefined;
  let resolveClose: (() => void) | undefined;
  let resolveExit!: (exit: {
    code: number | null;
    signal: NodeJS.Signals | null;
  }) => void;
  const closePromise = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
  const exitPromise = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => resolveExit = resolve);
  const write = (message: unknown): void => {
    if (!child.stdin.destroyed) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }
  };
  let stage = 0;
  let nativeSessionId = '';
  let nativeTurnId = '';
  const advanceProtocol = (message: JsonRecord): void => {
    const prompt = profile.protocol === 'codex-app-server'
      ? request.prompt
      : `${request.systemPrompt}\n\nUser request and visible context:\n${request.prompt}`;
    if (profile.protocol === 'codex-app-server') {
      if (stage === 0 && message.id === 1) {
        stage = 1;
        write({ jsonrpc: '2.0', method: 'initialized', params: {} });
        write({
          jsonrpc: '2.0',
          id: 2,
          method: 'thread/start',
          params: {
            cwd,
            developerInstructions: request.systemPrompt,
            ...(request.model ? { model: request.model } : {}),
            ...(request.effort ? { effort: request.effort } : {}),
          },
        });
      } else if (stage === 1 && message.id === 2) {
        const result = isRecord(message.result) ? message.result : {};
        const thread = isRecord(result.thread) ? result.thread : {};
        const threadId = stringValue(thread.id) || stringValue(result.threadId);
        if (!threadId) throw new Error('Codex did not return a thread id');
        nativeSessionId = threadId;
        stage = 2;
        write({
          jsonrpc: '2.0',
          id: 3,
          method: 'turn/start',
          params: {
            threadId,
            input: [{ type: 'text', text: prompt }],
            ...(request.model ? { model: request.model } : {}),
            ...(request.effort ? { effort: request.effort } : {}),
          },
        });
      } else if (stage === 2 && message.id === 3) {
        const result = isRecord(message.result) ? message.result : {};
        const turn = isRecord(result['turn']) ? result['turn'] : {};
        nativeTurnId = stringValue(turn.id) || stringValue(result['turnId']);
      }
    } else if (profile.protocol === 'acp') {
      if (stage === 0 && message.id === 1) {
        stage = 1;
        write({
          jsonrpc: '2.0',
          id: 2,
          method: 'session/new',
          params: { cwd, mcpServers: [] },
        });
      } else if (stage === 1 && message.id === 2) {
        const result = isRecord(message.result) ? message.result : {};
        const sessionId = stringValue(result.sessionId)
          || stringValue(result.id);
        if (!sessionId) {
          throw new Error(`${profile.name} did not return a session id`);
        }
        nativeSessionId = sessionId;
        stage = 2;
        write({
          jsonrpc: '2.0',
          id: 3,
          method: 'session/prompt',
          params: { sessionId, prompt: [{ type: 'text', text: prompt }] },
        });
      }
    }
  };
  const reducer = new ProtocolReducer(profile, write, advanceProtocol);

  child.stdout.on('data', (chunk: Buffer) => {
    try {
      for (const message of decoder.push(chunk)) {
        for (const event of reducer.accept(message)) {
          queue.push(event);
          if (event.type === 'assistant_final' || event.type === 'error') {
            queue.end();
          }
        }
      }
    } catch (error) {
      queue.push({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
      queue.end();
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trim();
    if (text) queue.push({ type: 'activity', text: text.slice(0, 4_096) });
  });
  child.on('error', (error) => {
    for (const event of reducer.fail(error.message)) queue.push(event);
    queue.end();
  });
  child.on('close', (code, signal) => {
    for (const event of reducer.finishFromExit()) queue.push(event);
    queue.end();
    resolveClose?.();
    resolveExit({ code, signal });
  });

  if (profile.protocol === 'claude-stream-json') {
    const prompt = request.prompt;
    write({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: prompt }] },
    });
    child.stdin.end();
  } else if (profile.protocol === 'codex-app-server') {
    write({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'lynx-genui-playground', version: '1' } },
    });
  } else {
    write({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: 1,
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
          terminal: false,
        },
        clientInfo: { name: 'lynx-genui-playground', version: '1' },
      },
    });
  }

  return {
    events: queue,
    ...(child.pid === undefined ? {} : { processId: child.pid }),
    exit: exitPromise,
    cancel() {
      const nativeCancelAvailable = profile.protocol === 'codex-app-server'
        ? Boolean(nativeSessionId && nativeTurnId)
        : (profile.protocol === 'acp' ? Boolean(nativeSessionId) : false);
      if (
        profile.protocol === 'codex-app-server'
        && nativeSessionId && nativeTurnId
      ) {
        write({
          jsonrpc: '2.0',
          id: randomRequestId(),
          method: 'turn/interrupt',
          params: {
            threadId: nativeSessionId,
            turnId: nativeTurnId,
          },
        });
      } else if (profile.protocol === 'acp' && nativeSessionId) {
        write({
          jsonrpc: '2.0',
          method: 'session/cancel',
          params: { sessionId: nativeSessionId },
        });
      }
      termination ??= terminateProcessGroup(
        child,
        nativeCancelAvailable ? 500 : 0,
      );
    },
    async close() {
      termination ??= terminateProcessGroup(child);
      await Promise.all([closePromise, termination]);
    },
  };
}

function terminateProcessGroup(
  child: ChildProcessWithoutNullStreams,
  graceMs = 0,
): Promise<void> {
  if (child.pid === undefined) return Promise.resolve();
  const processGroupId = child.pid;
  return new Promise((resolve) => {
    let settled = false;
    const timers: {
      term?: ReturnType<typeof setTimeout>;
      kill?: ReturnType<typeof setTimeout>;
      poll?: ReturnType<typeof setInterval>;
    } = {};
    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (timers.term) clearTimeout(timers.term);
      if (timers.kill) clearTimeout(timers.kill);
      if (timers.poll) clearInterval(timers.poll);
      resolve();
    };
    timers.poll = setInterval(() => {
      if (!processGroupExists(processGroupId)) finish();
    }, 25);
    if (!processGroupExists(processGroupId)) {
      finish();
      return;
    }
    timers.term = setTimeout(
      () => signalProcessGroup(child, processGroupId, 'SIGTERM'),
      graceMs,
    );
    timers.kill = setTimeout(
      () => signalProcessGroup(child, processGroupId, 'SIGKILL'),
      graceMs + 3_000,
    );
  });
}

function processGroupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function signalProcessGroup(
  child: ChildProcessWithoutNullStreams,
  processGroupId: number,
  signal: NodeJS.Signals,
): void {
  try {
    process.kill(-processGroupId, signal);
  } catch {
    if (child.exitCode === null) child.kill(signal);
  }
}

interface JsonRecord {
  [key: string]: unknown;
  __malformed?: unknown;
  command?: unknown;
  content?: unknown;
  delta?: unknown;
  event?: unknown;
  event_id?: unknown;
  eventId?: unknown;
  error?: unknown;
  id?: unknown;
  item?: unknown;
  message?: unknown;
  method?: unknown;
  name?: unknown;
  options?: unknown;
  optionId?: unknown;
  option_id?: unknown;
  kind?: unknown;
  params?: unknown;
  reason?: unknown;
  result?: unknown;
  sequence?: unknown;
  sessionId?: unknown;
  sessionUpdate?: unknown;
  stopReason?: unknown;
  stop_reason?: unknown;
  status?: unknown;
  subtype?: unknown;
  text?: unknown;
  thread?: unknown;
  threadId?: unknown;
  title?: unknown;
  type?: unknown;
  update?: unknown;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function randomRequestId(): number {
  return Date.now() + Math.floor(Math.random() * 1_000);
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isRecord(value) && value.type === 'text') return stringValue(value.text);
  if (!Array.isArray(value)) return '';
  return value.map((item) =>
    isRecord(item) && item.type === 'text'
      ? stringValue(item.text)
      : ''
  ).join('');
}

function acpAllowOption(params: JsonRecord): string | undefined {
  const options = Array.isArray(params.options) ? params.options : [];
  for (const option of options) {
    if (!isRecord(option)) continue;
    const kind = stringValue(option.kind).toLowerCase();
    if (kind === 'allow_once' || kind === 'allowonce') {
      return stringValue(option.optionId) || stringValue(option.option_id)
        || stringValue(option.id);
    }
  }
  return undefined;
}

function toolEventsFromContent(value: unknown): AgentEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AgentEvent[] =>
    isRecord(item) && item.type === 'tool_use'
      ? [{
        type: 'tool',
        name: stringValue(item.name) || 'tool',
        status: 'running',
      }]
      : []
  );
}

function eventFingerprint(message: JsonRecord): string {
  const id = message.eventId ?? message.event_id ?? message.sequence;
  if (typeof id === 'string' || typeof id === 'number') return String(id);
  return '';
}

function jsonRpcRequestIdentity(
  message: JsonRecord,
): { id: string; payload: string } | undefined {
  if (typeof message.method !== 'string' || !isJsonRpcId(message.id)) {
    return undefined;
  }
  return {
    id: jsonRpcIdKey(message.id),
    payload: stableJson({ method: message.method, params: message.params }),
  };
}

function isJsonRpcId(value: unknown): value is string | number | null {
  return value === null || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value));
}

function jsonRpcIdKey(value: unknown): string {
  if (!isJsonRpcId(value)) return 'invalid';
  return `${value === null ? 'null' : typeof value}:${String(value)}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${
      Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${stableJson(value[key])}`
      ).join(',')
    }}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function capabilityConflict(
  profile: AdapterProfile,
  result: JsonRecord,
): string | undefined {
  let capabilities: JsonRecord | undefined;
  if (isRecord(result['capabilities'])) {
    capabilities = result['capabilities'];
  } else if (isRecord(result['agentCapabilities'])) {
    capabilities = result['agentCapabilities'];
  }
  if (!capabilities) return undefined;
  const checks: [keyof AgentCapabilities, readonly string[]][] = [
    ['tools', ['tools', 'toolCalls', 'tool_calls']],
    ['approvals', ['approvals', 'permissions', 'requestPermission']],
    ['cancellation', ['cancellation', 'cancel']],
  ];
  for (const [capability, keys] of checks) {
    if (!profile.capabilities[capability]) continue;
    const declared = keys.map((key) => capabilities[key]).find((value) =>
      typeof value === 'boolean'
    );
    if (declared === false) {
      return `${profile.name} protocol negotiation disabled required ${capability} capability`;
    }
  }
  return undefined;
}

function protocolSequence(message: JsonRecord): number | undefined {
  const value = message.sequence;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    const sequence = Number(value);
    return Number.isSafeInteger(sequence) ? sequence : undefined;
  }
  return undefined;
}

/** Test hook for protocol fixtures; no process is launched. */
export function reduceProtocolFixture(
  agentId: AgentId,
  messages: readonly unknown[],
): AgentEvent[] {
  const profile = ADAPTER_PROFILES.find((candidate) =>
    candidate.id === agentId
  );
  if (!profile) throw new Error(`Unknown adapter: ${agentId}`);
  const events: AgentEvent[] = [];
  const reducer = new ProtocolReducer(
    profile,
    () => {
      // Fixture reductions never write protocol responses.
    },
    () => {
      // Fixture reductions do not advance live handshakes.
    },
  );
  for (const message of messages) events.push(...reducer.accept(message));
  return events;
}

/** Test hook for protocol fixtures that must inspect native reply payloads. */
export function reduceProtocolFixtureWithResponses(
  agentId: AgentId,
  messages: readonly unknown[],
): { events: AgentEvent[]; responses: unknown[] } {
  const profile = ADAPTER_PROFILES.find((candidate) =>
    candidate.id === agentId
  );
  if (!profile) throw new Error(`Unknown adapter: ${agentId}`);
  const events: AgentEvent[] = [];
  const responses: unknown[] = [];
  const reducer = new ProtocolReducer(
    profile,
    (response) => responses.push(response),
    () => {
      // Fixture reductions do not advance live handshakes.
    },
  );
  for (const message of messages) events.push(...reducer.accept(message));
  return { events, responses };
}

/**
 * Opt-in behavior probe. It never logs in, installs, approves, or sends a
 * generation request.
 */
export function probeInstalledAgents(
  cwd: string,
  environment: NodeJS.ProcessEnv = process.env,
): AgentDescriptor[] {
  return [...createAgentAdapters(cwd, environment).values()]
    .map((adapter) => adapter.descriptor);
}
