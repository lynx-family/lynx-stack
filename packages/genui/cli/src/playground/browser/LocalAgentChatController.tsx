// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import type {
  LocalAgentDescriptor,
  LocalAgentId,
  LocalAgentModelOption,
  LocalApproval,
  LocalConversation,
  LocalConversationSnapshot,
  LocalDaemonClient,
  LocalPlaygroundEvent,
  LocalTurn,
} from './api-client.js';
import { IsolatedLynxXmlFrame } from './IsolatedLynxXmlFrame.js';
import { submitTurnWithSessionRetry } from './turn-admission.js';
import type {
  ChatMessageModel,
  ChatSettingControl,
  MobilePaneTab,
  PreviewFrameRenderer,
} from '../../../../playground/src/shared-ui/index.js';
import {
  ArtifactViewer,
  Button,
  ChatTranscript,
  ChatWorkspace,
  LYNX_XML_PRESENTATION,
  PreviewPanel,
  PreviewViewport,
  PromptComposer,
  Sparkles,
  createLynxXmlArtifact,
  useCopyToast,
  useResizablePanels,
} from '../../../../playground/src/shared-ui/index.js';

const ACTIVE_TURN_STATUSES = new Set<LocalTurn['status']>([
  'accepted',
  'starting',
  'running',
  'awaiting_approval',
  'cancelling',
]);
const TURN_STATUS_ORDER: Record<LocalTurn['status'], number> = {
  accepted: 0,
  starting: 1,
  running: 2,
  awaiting_approval: 3,
  cancelling: 4,
  completed: 5,
  failed: 5,
  cancelled: 5,
  interrupted: 5,
};

interface LocalAgentChatControllerProps {
  client: LocalDaemonClient;
}

interface AgentConfiguration {
  agentId: LocalAgentId | '';
  model: string;
  effort: string;
}

interface ModelCatalogState {
  agentId: LocalAgentId | '';
  status: 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';
  models: LocalAgentModelOption[];
}

interface ActiveTurnBinding {
  conversationId: string;
  turnId: string;
}

const EMPTY_CONFIGURATION: AgentConfiguration = {
  agentId: '',
  model: '',
  effort: '',
};

const EMPTY_MODEL_CATALOG: ModelCatalogState = {
  agentId: '',
  status: 'idle',
  models: [],
};

function isUsableAgent(agent: LocalAgentDescriptor): boolean {
  return agent.available && agent.authentication === 'authenticated';
}

function stringPayload(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function isApprovalDecision(
  value: unknown,
): value is 'allow_once' | 'deny' {
  return value === 'allow_once' || value === 'deny';
}

function mergeTurn(current: LocalTurn, incoming: LocalTurn): LocalTurn {
  return TURN_STATUS_ORDER[incoming.status] >= TURN_STATUS_ORDER[current.status]
    ? { ...current, ...incoming, prompt: incoming.prompt || current.prompt }
    : current;
}

function readTurn(event: LocalPlaygroundEvent): LocalTurn | null {
  const value = event.payload['turn'];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as LocalTurn
    : null;
}

function turnKey(binding: ActiveTurnBinding): string {
  return binding.conversationId + ':' + binding.turnId;
}

function turnStatusMessage(turn: LocalTurn): ChatMessageModel {
  if (turn.status === 'completed') {
    return {
      id: turn.id + ':status',
      kind: 'status',
      tone: 'success',
      icon: 'sparkles',
      text: turn.revision
        ? 'Generated Lynx XML revision ' + turn.revision + '.'
        : 'Generated a complete Lynx XML artifact.',
    };
  }
  if (turn.status === 'failed') {
    return {
      id: turn.id + ':status',
      kind: 'status',
      tone: 'error',
      icon: 'error',
      text: 'Generation failed: ' + (turn.error ?? 'Unknown Agent error'),
    };
  }
  if (turn.status === 'cancelled' || turn.status === 'interrupted') {
    return {
      id: turn.id + ':status',
      kind: 'status',
      tone: 'error',
      icon: 'error',
      text: turn.status === 'cancelled'
        ? 'Generation cancelled.'
        : 'Generation was interrupted when the local daemon stopped.',
    };
  }
  return {
    id: turn.id + ':status',
    kind: 'status',
    tone: 'pending',
    icon: 'spinner',
    text: turn.status === 'awaiting_approval'
      ? 'The local Agent is waiting for your approval.'
      : 'Local Agent turn ' + turn.status.replaceAll('_', ' ') + '…',
  };
}

function messagesForSnapshot(
  snapshot: LocalConversationSnapshot | null,
  liveMessages: Readonly<Record<string, ChatMessageModel[]>>,
): ChatMessageModel[] {
  const messages: ChatMessageModel[] = [{
    id: 'local-agent-welcome',
    kind: 'assistant',
    text:
      'Describe the interface you want. Your selected local coding Agent will return a complete .lynxml artifact for the isolated preview.',
  }];
  for (const turn of snapshot?.turns ?? []) {
    messages.push({
      id: turn.id + ':prompt',
      kind: 'user',
      side: 'right',
      text: turn.prompt,
    });
    messages.push(...(liveMessages[turn.id] ?? []));
    messages.push(turnStatusMessage(turn));
  }
  return messages;
}

export function LocalAgentChatController(
  props: LocalAgentChatControllerProps,
) {
  const { client } = props;
  const [agents, setAgents] = useState<LocalAgentDescriptor[]>([]);
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LocalConversationSnapshot | null>(
    null,
  );
  const [configuration, setConfiguration] = useState(EMPTY_CONFIGURATION);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogState>(
    EMPTY_MODEL_CATALOG,
  );
  const [inputValue, setInputValue] = useState('');
  const [artifactSource, setArtifactSource] = useState('');
  const [artifactIdentity, setArtifactIdentity] = useState('empty');
  const [localExampleTitle, setLocalExampleTitle] = useState('');
  const [liveMessages, setLiveMessages] = useState<
    Record<string, ChatMessageModel[]>
  >({});
  const [activeBinding, setActiveBinding] = useState<
    ActiveTurnBinding | null
  >(null);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<MobilePaneTab>('edit');
  const [reconnectGeneration, setReconnectGeneration] = useState(0);
  const { showCopyToast, toast: copyToast } = useCopyToast();
  const messagesRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef(0);
  const activeIdRef = useRef<string | null>(null);
  const agentsRef = useRef<LocalAgentDescriptor[]>([]);
  const pendingSubmissionsRef = useRef(new Map<string, Promise<LocalTurn>>());
  const cancellationIntentsRef = useRef(new Set<string>());
  const cancellationRequestsRef = useRef(
    new Map<string, Promise<LocalTurn>>(),
  );
  const {
    containerRef: pageRef,
    handleResizeStart,
    isCompactLayout,
    isResizing,
    primaryPanelStyle,
    secondaryPanelStyle,
  } = useResizablePanels({
    breakpoint: 980,
    compactPrimaryMinSize: 280,
    compactSecondaryMinSize: 320,
    desktopPrimaryMinSize: 360,
    desktopSecondaryMinSize: 360,
    initialPrimarySize: 400,
    initialSecondarySize: 560,
  });

  activeIdRef.current = activeId;
  agentsRef.current = agents;

  const setErrorFrom = useCallback((caught: unknown) => {
    setError(caught instanceof Error ? caught.message : String(caught));
  }, []);

  const refreshConversationList = useCallback(async () => {
    const result = await client.conversations();
    const visible = result.conversations.filter((item) => !item.archived);
    setConversations(visible);
    setWarnings(result.warnings);
    const durableActive = result.conversations.find((item) => item.activeTurn);
    if (durableActive?.activeTurn) {
      setActiveBinding({
        conversationId: durableActive.id,
        turnId: durableActive.activeTurn,
      });
    } else if (pendingSubmissionsRef.current.size === 0) {
      setActiveBinding(null);
    }
    return visible;
  }, [client]);

  const loadArtifact = useCallback(async (
    conversation: LocalConversation,
  ) => {
    if (!conversation.latestRevision) {
      setArtifactSource('');
      setArtifactIdentity('conversation:' + conversation.id + ':empty');
      return;
    }
    const source = await client.artifact(
      conversation.id,
      conversation.latestRevision,
    );
    if (activeIdRef.current !== conversation.id) return;
    setArtifactSource(source);
    setArtifactIdentity(
      'conversation:' + conversation.id + ':'
        + conversation.latestRevision + ':'
        + (conversation.latestArtifactHash ?? ''),
    );
    setLocalExampleTitle('');
  }, [client]);

  const loadConversation = useCallback(async (
    id: string,
    knownAgents: LocalAgentDescriptor[] = agentsRef.current,
  ) => {
    const next = await client.snapshot(id);
    if (activeIdRef.current !== id) return;
    sequenceRef.current = next.sequence;
    setSnapshot(next);
    setLiveMessages({});
    const session = next.conversation.sessions.find((candidate) =>
      candidate.id === next.conversation.currentSessionId
    );
    const fallback = knownAgents.find((agent) => isUsableAgent(agent));
    setConfiguration({
      agentId: session?.agentId ?? fallback?.id ?? '',
      model: session?.model ?? '',
      effort: session?.effort ?? '',
    });
    await loadArtifact(next.conversation);
  }, [client, loadArtifact]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [nextAgents, nextConversations] = await Promise.all([
          client.agents(),
          refreshConversationList(),
        ]);
        if (!alive) return;
        agentsRef.current = nextAgents;
        setAgents(nextAgents);
        let target = nextConversations[0];
        if (!target) {
          const id = crypto.randomUUID();
          target = await client.createConversation(id, 'New Lynx interface');
          if (!alive) return;
          await refreshConversationList();
        }
        activeIdRef.current = target.id;
        setActiveId(target.id);
        await loadConversation(target.id, nextAgents);
      } catch (caught) {
        if (alive) setErrorFrom(caught);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, loadConversation, refreshConversationList, setErrorFrom]);

  useEffect(() => {
    const agentId = configuration.agentId;
    const agent = agents.find((candidate) => candidate.id === agentId);
    if (!agentId || !agent || !isUsableAgent(agent)) {
      setModelCatalog(EMPTY_MODEL_CATALOG);
      return;
    }
    let alive = true;
    setModelCatalog({ agentId, status: 'loading', models: [] });
    void client.agentModels(agentId).then(
      (catalog) => {
        if (!alive) return;
        if (catalog.status === 'unsupported') {
          setModelCatalog({ agentId, status: 'unsupported', models: [] });
          setConfiguration((current) =>
            current.agentId === agentId
              ? { ...current, model: '' }
              : current
          );
          return;
        }
        setModelCatalog({
          agentId,
          status: 'ready',
          models: catalog.models,
        });
        setConfiguration((current) => {
          if (current.agentId !== agentId) return current;
          const model = catalog.models.find((option) =>
            option.value === current.model
          );
          if (current.model && !model) {
            return { ...current, model: '', effort: '' };
          }
          if (
            current.effort && model?.efforts !== undefined
            && !model.efforts.includes(current.effort)
          ) {
            return { ...current, effort: '' };
          }
          return current;
        });
      },
      () => {
        if (!alive) return;
        setModelCatalog({ agentId, status: 'error', models: [] });
        setConfiguration((current) =>
          current.agentId === agentId
            ? { ...current, model: '' }
            : current
        );
      },
    );
    return () => {
      alive = false;
    };
  }, [agents, client, configuration.agentId]);

  const refreshCurrentSnapshot = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    const next = await client.snapshot(id);
    if (activeIdRef.current !== id) return;
    sequenceRef.current = Math.max(sequenceRef.current, next.sequence);
    setSnapshot(next);
    if (next.conversation.latestRevision) {
      await loadArtifact(next.conversation);
    }
  }, [client, loadArtifact]);

  const applyEvent = useCallback((event: LocalPlaygroundEvent) => {
    if (event.sequence <= sequenceRef.current) return;
    sequenceRef.current = event.sequence;
    const turn = readTurn(event);
    if (turn) {
      setSnapshot((current) => {
        if (!current) return current;
        const index = current.turns.findIndex((item) => item.id === turn.id);
        const turns = [...current.turns];
        if (index >= 0) turns[index] = mergeTurn(turns[index]!, turn);
        else turns.push(turn);
        return { ...current, turns, sequence: event.sequence };
      });
      if (!ACTIVE_TURN_STATUSES.has(turn.status)) {
        setActiveBinding((current) =>
          current?.turnId === turn.id ? null : current
        );
      }
    }
    const turnId = event.turnId;
    if (turnId && event.type === 'assistant.delta') {
      const text = typeof event.payload['text'] === 'string'
        ? event.payload['text']
        : '';
      setLiveMessages((current) => {
        const messages = [...(current[turnId] ?? [])];
        const id = turnId + ':assistant-delta';
        const index = messages.findIndex((message) => message.id === id);
        const next: ChatMessageModel = {
          id,
          kind: 'assistant',
          text: (index >= 0 ? messages[index]?.text ?? '' : '') + text,
        };
        if (index >= 0) messages[index] = next;
        else messages.push(next);
        return { ...current, [turnId]: messages };
      });
    }
    if (turnId && (event.type === 'activity' || event.type === 'tool')) {
      const text = event.type === 'tool'
        ? 'Tool: ' + stringPayload(event.payload['name'], 'tool') + ' · '
          + stringPayload(event.payload['status'], 'running')
        : stringPayload(event.payload['text'], 'Agent is working…');
      setLiveMessages((current) => ({
        ...current,
        [turnId]: [
          ...(current[turnId] ?? []),
          {
            id: turnId + ':' + String(event.sequence),
            kind: 'action',
            icon: event.type === 'tool' ? 'zap' : 'spinner',
            text,
          },
        ],
      }));
    }
    if (event.type === 'approval.requested' && turnId) {
      const requestId = stringPayload(event.payload['requestId'], '');
      const rawDecisions = event.payload['decisions'];
      const decisions: Array<'allow_once' | 'deny'> =
        Array.isArray(rawDecisions)
          ? rawDecisions.filter((decision) => isApprovalDecision(decision))
          : ['deny'];
      setSnapshot((current) =>
        current
          ? {
            ...current,
            pendingApprovals: [
              ...current.pendingApprovals.filter((item) =>
                item.requestId !== requestId
              ),
              {
                requestId,
                turnId,
                prompt: stringPayload(
                  event.payload['prompt'],
                  'Agent requests permission',
                ),
                decisions,
              },
            ],
          }
          : current
      );
    }
    if (event.type === 'approval.resolved') {
      const requestId = stringPayload(event.payload['requestId'], '');
      setSnapshot((current) =>
        current
          ? {
            ...current,
            pendingApprovals: current.pendingApprovals.filter((item) =>
              item.requestId !== requestId
            ),
          }
          : current
      );
    }
    if (event.type === 'turn.completed' || event.type === 'artifact.ready') {
      void refreshCurrentSnapshot().then(refreshConversationList).catch(
        setErrorFrom,
      );
    } else if (
      event.type === 'conversation.updated'
      || event.type === 'turn.failed'
      || event.type === 'turn.cancelled'
      || event.type === 'turn.interrupted'
    ) {
      void refreshConversationList();
    }
    if (event.type === 'context.truncated' || event.truncated) {
      const warning = event.type === 'context.truncated'
        ? 'Older visible history was truncated by the daemon.'
        : 'An oversized Agent event was truncated by the daemon.';
      setWarnings((current) => [...new Set([...current, warning])]);
    }
  }, [
    refreshConversationList,
    refreshCurrentSnapshot,
    setErrorFrom,
  ]);

  useEffect(() => {
    if (!activeId) return;
    let reconnectTimer: number | undefined;
    const source = client.subscribe(
      activeId,
      sequenceRef.current,
      applyEvent,
      () => {
        source.close();
        reconnectTimer = window.setTimeout(() => {
          if (activeIdRef.current === activeId) {
            void refreshCurrentSnapshot().finally(() =>
              setReconnectGeneration(reconnectGeneration + 1)
            );
          }
        }, 1_000);
      },
    );
    return () => {
      source.close();
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    };
  }, [
    activeId,
    applyEvent,
    client,
    reconnectGeneration,
    refreshCurrentSnapshot,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: streamed text and durable turn changes intentionally trigger this imperative scroll.
  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [liveMessages, snapshot?.turns]);

  const selectConversation = useCallback(async (id: string) => {
    if (id === activeIdRef.current) return;
    activeIdRef.current = id;
    setActiveId(id);
    setSnapshot(null);
    setArtifactSource('');
    setLocalExampleTitle('');
    setError('');
    try {
      await loadConversation(id);
    } catch (caught) {
      setErrorFrom(caught);
    }
  }, [loadConversation, setErrorFrom]);

  const createConversation = useCallback(async () => {
    try {
      const id = crypto.randomUUID();
      await client.createConversation(id, 'New Lynx interface');
      await refreshConversationList();
      await selectConversation(id);
    } catch (caught) {
      setErrorFrom(caught);
    }
  }, [client, refreshConversationList, selectConversation, setErrorFrom]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      const conversation = await client.patchConversation(id, { title });
      setConversations((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...conversation } : item
        )
      );
      setSnapshot((current) =>
        current?.conversation.id === id
          ? { ...current, conversation }
          : current
      );
    } catch (caught) {
      setErrorFrom(caught);
    }
  }, [client, setErrorFrom]);

  const dispatchCancellation = useCallback(async (
    binding: ActiveTurnBinding,
  ): Promise<LocalTurn> => {
    const key = turnKey(binding);
    const existing = cancellationRequestsRef.current.get(key);
    if (existing) return await existing;
    const request = client.cancel(binding.conversationId, binding.turnId);
    cancellationRequestsRef.current.set(key, request);
    try {
      const turn = await request;
      if (turn.id !== binding.turnId || turn.status !== 'cancelled') {
        throw new Error('Cancellation response did not match the active turn');
      }
      setSnapshot((current) => {
        if (!current || current.conversation.id !== binding.conversationId) {
          return current;
        }
        return {
          ...current,
          turns: current.turns.map((item) =>
            item.id === turn.id ? mergeTurn(item, turn) : item
          ),
        };
      });
      setActiveBinding((current) =>
        current?.turnId === turn.id ? null : current
      );
      return turn;
    } finally {
      cancellationRequestsRef.current.delete(key);
      cancellationIntentsRef.current.delete(key);
    }
  }, [client]);

  const cancelActiveTurn = useCallback(async () => {
    const binding = activeBinding;
    if (!binding) return;
    const key = turnKey(binding);
    cancellationIntentsRef.current.add(key);
    try {
      const pending = pendingSubmissionsRef.current.get(binding.turnId);
      if (pending) await pending;
      if (cancellationIntentsRef.current.has(key)) {
        await dispatchCancellation(binding);
      }
    } catch (caught) {
      setErrorFrom(caught);
    }
  }, [activeBinding, dispatchCancellation, setErrorFrom]);

  const submitPrompt = useCallback(async () => {
    const conversationId = activeIdRef.current;
    const prompt = inputValue.trim();
    if (!conversationId || !prompt || !configuration.agentId) return;
    const existingSession = snapshot?.conversation.sessions.find((session) =>
      session.agentId === configuration.agentId
      && (session.model ?? '') === configuration.model
      && (session.effort ?? '') === configuration.effort
    );
    const sessionId = existingSession?.id ?? crypto.randomUUID();
    const turnId = crypto.randomUUID();
    const agentConfiguration = {
      agentId: configuration.agentId,
      ...(configuration.model ? { model: configuration.model } : {}),
      ...(configuration.effort ? { effort: configuration.effort } : {}),
    };
    const optimistic: LocalTurn = {
      id: turnId,
      conversationId,
      sessionId,
      prompt,
      ...agentConfiguration,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
    };
    const submission = submitTurnWithSessionRetry(
      () =>
        client.putSession(
          conversationId,
          sessionId,
          agentConfiguration,
        ),
      () =>
        client.putTurn(conversationId, turnId, {
          sessionId,
          prompt,
          ...agentConfiguration,
        }),
    );
    pendingSubmissionsRef.current.set(turnId, submission);
    const binding = { conversationId, turnId };
    setActiveBinding(binding);
    setInputValue('');
    setLocalExampleTitle('');
    setSnapshot((current) =>
      current
        ? { ...current, turns: [...current.turns, optimistic] }
        : current
    );
    try {
      const accepted = await submission;
      setSnapshot((current) =>
        current
          ? {
            ...current,
            turns: current.turns.map((item) =>
              item.id === accepted.id ? mergeTurn(item, accepted) : item
            ),
          }
          : current
      );
      if (cancellationIntentsRef.current.has(turnKey(binding))) {
        await dispatchCancellation(binding);
      }
    } catch (caught) {
      cancellationIntentsRef.current.delete(turnKey(binding));
      setActiveBinding((current) =>
        current?.turnId === turnId ? null : current
      );
      setSnapshot((current) =>
        current
          ? {
            ...current,
            turns: current.turns.filter((item) => item.id !== turnId),
          }
          : current
      );
      setErrorFrom(caught);
    } finally {
      pendingSubmissionsRef.current.delete(turnId);
      await refreshConversationList().catch(() => undefined);
    }
  }, [
    client,
    configuration,
    dispatchCancellation,
    inputValue,
    refreshConversationList,
    setErrorFrom,
    snapshot?.conversation.sessions,
  ]);

  const selectedAgent = agents.find((agent) =>
    agent.id === configuration.agentId
  );
  const usableAgents = agents.filter((agent) => isUsableAgent(agent));
  const controls = useMemo<ChatSettingControl[]>(() => {
    const result: ChatSettingControl[] = [{
      id: 'localAgentAgent',
      label: 'Coding Agent',
      kind: 'select',
      value: configuration.agentId,
      options: agents.map((agent) => ({
        value: agent.id,
        label: isUsableAgent(agent)
          ? agent.name
          : agent.name + ' — unavailable',
        disabled: !isUsableAgent(agent),
      })),
    }];
    const activeCatalog = modelCatalog.agentId === configuration.agentId
      ? modelCatalog
      : EMPTY_MODEL_CATALOG;
    let defaultModelLabel = 'Agent default';
    if (activeCatalog.status === 'loading') {
      defaultModelLabel = 'Loading models…';
    } else if (activeCatalog.status === 'error') {
      defaultModelLabel = 'Agent default · models unavailable';
    }
    const modelControl: ChatSettingControl = {
      id: 'localAgentModel',
      label: 'Model',
      kind: 'select',
      value: activeCatalog.status === 'ready' ? configuration.model : '',
      disabled: activeCatalog.status !== 'ready',
      fadeOverflow: true,
      options: [{
        value: '',
        label: defaultModelLabel,
      }],
    };
    if (activeCatalog.status === 'ready') {
      modelControl.options = [
        { value: '', label: 'Agent default' },
        ...activeCatalog.models.map((model) => ({
          value: model.value,
          label: model.label,
        })),
      ];
      modelControl.disabled = false;
    } else if (activeCatalog.status === 'unsupported') {
      modelControl.title =
        'This Agent does not expose a model list. Its configured default will be used.';
    } else if (activeCatalog.status === 'error') {
      modelControl.title =
        'The model list could not be loaded. The Agent default will be used.';
    }
    result.push(modelControl);
    if (selectedAgent?.capabilities.effort) {
      const selectedModel = activeCatalog.status === 'ready'
        ? activeCatalog.models.find((model) =>
          model.value === configuration.model
        )
        : undefined;
      const efforts = selectedModel?.efforts ?? selectedAgent.efforts;
      result.push({
        id: 'localAgentEffort',
        label: 'Reasoning effort',
        kind: 'select',
        value: configuration.effort,
        disabled: efforts.length === 0,
        options: [
          { value: '', label: 'Default effort' },
          ...efforts.map((effort) => ({
            value: effort,
            label: effort,
          })),
        ],
      });
    }
    return result;
  }, [agents, configuration, modelCatalog, selectedAgent]);

  const updateConfiguration = useCallback((id: string, value: string) => {
    setConfiguration((current) => {
      if (id === 'localAgentAgent') {
        return { agentId: value as LocalAgentId, model: '', effort: '' };
      }
      if (id === 'localAgentModel') {
        const selectedModel = modelCatalog.agentId === current.agentId
            && modelCatalog.status === 'ready'
          ? modelCatalog.models.find((model) => model.value === value)
          : undefined;
        return {
          ...current,
          model: value,
          effort: current.effort && selectedModel?.efforts !== undefined
              && !selectedModel.efforts.includes(current.effort)
            ? ''
            : current.effort,
        };
      }
      if (id === 'localAgentEffort') return { ...current, effort: value };
      return current;
    });
  }, [modelCatalog]);

  const loadLocalExample = useCallback((index: number) => {
    const scenario = LYNX_XML_PRESENTATION.examples.items[index];
    if (!scenario) return;
    const example = LYNX_XML_PRESENTATION.examples.load(scenario);
    setArtifactSource(example.output.source);
    setArtifactIdentity(
      'local-example:' + scenario.id + ':' + String(Date.now()),
    );
    setLocalExampleTitle(scenario.title);
  }, []);

  const chatMessages = useMemo(() => {
    const messages = messagesForSnapshot(snapshot, liveMessages);
    if (localExampleTitle) {
      messages.push({
        id: 'local-example-status',
        kind: 'status',
        tone: 'success',
        icon: 'zap',
        text: 'Loaded local Lynx XML example ' + localExampleTitle
          + '. No Agent call was made.',
      });
    }
    return messages;
  }, [liveMessages, localExampleTitle, snapshot]);

  const artifact = artifactSource
    ? createLynxXmlArtifact({ source: artifactSource })
    : null;
  const busy = activeBinding !== null;
  const composerDisabled = loading || busy || usableAgents.length === 0
    || !configuration.agentId;
  const noAgentReason = usableAgents.length === 0
    ? 'No supported local coding Agent is installed and available. Install or authenticate Codex, Claude Code, Cursor Agent, or Trae CLI, then restart the playground.'
    : '';
  const isolationWarning = client.bootstrap.previewIsolation.isolationCompliant
    ? ''
    : 'Preview isolation is degraded: '
      + (client.bootstrap.previewIsolation.reason
        ?? 'independent localhost preview is unavailable');
  const visibleWarnings = [isolationWarning, noAgentReason, ...warnings, error]
    .filter(Boolean);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      void submitPrompt();
    },
    [submitPrompt],
  );

  const handleApproval = useCallback(async (
    approval: LocalApproval,
    decision: 'allow_once' | 'deny',
  ) => {
    const conversationId = activeIdRef.current;
    if (!conversationId) return;
    try {
      await client.approve(conversationId, approval.requestId, decision);
      setSnapshot((current) =>
        current
          ? {
            ...current,
            pendingApprovals: current.pendingApprovals.filter((item) =>
              item.requestId !== approval.requestId
            ),
          }
          : current
      );
    } catch (caught) {
      setErrorFrom(caught);
    }
  }, [client, setErrorFrom]);

  const currentConversation = snapshot?.conversation;
  const currentConversationId = currentConversation?.id;
  const currentRevision = currentConversation?.latestRevision;
  const currentArtifactHash = currentConversation?.latestArtifactHash;
  const frameRenderer = useMemo<PreviewFrameRenderer | undefined>(() => {
    if (!artifactSource) return undefined;
    return (frameProps) => (
      <IsolatedLynxXmlFrame
        {...frameProps}
        source={artifactSource}
        identity={artifactIdentity}
        previewOrigin={client.bootstrap.previewOrigin}
        {...(localExampleTitle || !currentConversationId
          ? {}
          : {
            conversationId: currentConversationId,
            ...(currentRevision
              ? { revision: currentRevision }
              : {}),
            ...(currentArtifactHash
              ? { hash: currentArtifactHash }
              : {}),
          })}
      />
    );
  }, [
    artifactIdentity,
    artifactSource,
    client.bootstrap.previewOrigin,
    currentArtifactHash,
    currentConversationId,
    currentRevision,
    localExampleTitle,
  ]);

  return (
    <ChatWorkspace
      pageRef={pageRef}
      pageClassName='localAgentChatPage'
      isPanelResizing={isResizing}
      isCompactLayout={isCompactLayout}
      activeMobileTab={activeMobileTab}
      onMobileTabChange={setActiveMobileTab}
      copyToast={copyToast}
      deleteConfirmation={{
        open: false,
        conversationTitle: '',
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }}
      conversation={{
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          updatedAt: Date.parse(conversation.updatedAt),
          messageCount: conversation.turns ?? 0,
          ...(conversation.initialRequest
            ? { previewText: conversation.initialRequest }
            : {}),
        })),
        activeId,
        disabled: loading || busy,
        actions: {
          create: true,
          switch: true,
          rename: true,
          share: false,
          remove: false,
        },
        createButtonId: 'new',
        isPersistent: true,
        onCreate: () => void createConversation(),
        onSwitch: (id) => void selectConversation(id),
        onShare: () => undefined,
        onRename: (id, title) => void renameConversation(id, title),
        onRemove: () => undefined,
      }}
      header={{
        title: 'Create',
        description: LYNX_XML_PRESENTATION.copy.description,
        topContent: (
          <>
            <span
              className='constructionBadge localAgentBadge'
              title='Requests run through your selected local coding Agent'
            >
              {selectedAgent?.name ?? 'Local coding Agent'}
            </span>
            <button
              type='button'
              className='chatExamplesLink'
              onClick={() => {
                window.location.hash = '#/lynx-xml/examples';
              }}
            >
              Browse examples
            </button>
            <Button
              id='global-cancel'
              variant='danger'
              size='sm'
              className='localAgentStop'
              hidden={!activeBinding}
              disabled={!activeBinding}
              data-active-turn-id={activeBinding?.turnId ?? ''}
              data-active-conversation-id={activeBinding?.conversationId ?? ''}
              onClick={() => void cancelActiveTurn()}
            >
              Stop
            </Button>
          </>
        ),
      }}
      messagesRef={messagesRef}
      messages={
        <>
          {visibleWarnings.map((warning) => (
            <div className='localAgentNotice' key={warning} role='status'>
              {warning}
            </div>
          ))}
          <ChatTranscript
            messages={chatMessages}
            onCopy={(text) =>
              void navigator.clipboard.writeText(text).then(
                () => showCopyToast(true),
                () => showCopyToast(false),
              )}
          />
          {snapshot?.pendingApprovals.map((approval) => (
            <section
              className='localAgentApproval'
              data-approval-id={approval.requestId}
              key={approval.requestId}
              aria-label='Agent approval request'
            >
              <strong>Approval requested</strong>
              <p>{approval.prompt}</p>
              <div className='localAgentApprovalActions'>
                {approval.decisions.includes('allow_once')
                  ? (
                    <Button
                      size='sm'
                      variant='primary'
                      data-decision='allow_once'
                      onClick={() =>
                        void handleApproval(approval, 'allow_once')}
                    >
                      Allow once
                    </Button>
                  )
                  : null}
                <Button
                  size='sm'
                  variant='danger'
                  data-decision='deny'
                  onClick={() => void handleApproval(approval, 'deny')}
                >
                  Deny
                </Button>
              </div>
            </section>
          ))}
          {artifact
            ? (
              <ArtifactViewer
                artifact={artifact}
                onCopy={(text) => {
                  void navigator.clipboard.writeText(text).then(
                    () => showCopyToast(true),
                    () => showCopyToast(false),
                  );
                }}
              />
            )
            : null}
        </>
      }
      composer={
        <PromptComposer
          formId='prompt-form'
          inputId='prompt'
          showStarterContent={(snapshot?.turns.length ?? 0) === 0}
          suggestions={LYNX_XML_PRESENTATION.suggestions.map((suggestion) => ({
            id: suggestion.label,
            label: suggestion.label,
            onSelect: () => setInputValue(suggestion.text),
          }))}
          examples={LYNX_XML_PRESENTATION.examples.items.map(
            (scenario, index) => ({
              id: scenario.id,
              label: scenario.title,
              title: scenario.description,
              onSelect: () => loadLocalExample(index),
            }),
          )}
          promptHint='· uses selected local Agent'
          examplesHint='· no Agent call'
          privacyNotice={
            <>
              <strong>Local mode:</strong>{' '}
              prompts are sent to the selected coding Agent installed on this
              computer. That Agent may use network services or tools according
              to its own configuration.
            </>
          }
          inputAriaLabel={LYNX_XML_PRESENTATION.copy.inputAriaLabel}
          inputPlaceholder={LYNX_XML_PRESENTATION.copy.inputPlaceholder}
          value={inputValue}
          disabled={composerDisabled}
          controls={controls}
          onValueChange={setInputValue}
          onKeyDown={handleKeyDown}
          onControlChange={updateConfiguration}
          onSubmit={() => void submitPrompt()}
          submitLabel={busy ? 'Generating' : 'Send'}
        />
      }
      chatPanelStyle={primaryPanelStyle}
      resizeHandle={{
        ariaLabel: 'Resize Create and preview panels',
        onPointerDown: handleResizeStart,
      }}
      preview={
        <PreviewPanel
          className='previewPanel'
          style={secondaryPanelStyle}
          title='Lynx Preview'
          showPreviewModeSwitch
          previewInfoHint={artifactSource
            ? 'Generated content runs on a separate credential-free localhost origin.'
            : LYNX_XML_PRESENTATION.preview.emptyHint}
        >
          <PreviewViewport
            key={artifactIdentity}
            iframeTitle='Isolated local Lynx XML preview'
            {...(frameRenderer ? { frameRenderer } : {})}
            emptyIcon={<Sparkles size={28} strokeWidth={1.5} />}
            emptyTitle={LYNX_XML_PRESENTATION.preview.emptyTitle}
            emptySubTitle={LYNX_XML_PRESENTATION.preview.emptySubtitle}
          />
        </PreviewPanel>
      }
    />
  );
}
