// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ActionEvent,
  ActionPlan,
  ElementNode,
  EvaluationContext,
  McpClientLike,
  OpenUIError,
  ParseResult,
  Store,
  ToolProvider,
} from '@openuidev/lang-core';
import {
  ACTION_STEPS,
  BuiltinActionType,
  ToolNotFoundError,
  createStore,
  extractToolResult,
} from '@openuidev/lang-core';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { OpenUIContext, useOpenUI, useRenderNode } from './context.jsx';
import { useOpenUIState } from './hooks/useOpenUIState.js';
import type { ComponentRenderer, Library, RenderOutput } from './library.jsx';
import { keyFrom } from './utils.js';
import type { LegacyActionConfig } from '../catalog/Action/index.jsx';

export type { Library, RenderOutput };

export type ToolProviderInput =
  | Record<string, (args: Record<string, unknown>) => unknown>
  | McpClientLike
  | null;

export interface OpenUiRendererRuntimeProps {
  /** Raw openui-lang response text. This enables v0.5 runtime features. */
  response: string | null;
  /** Component library from createOpenUiLibrary(). */
  library: Library;
  /** Whether the LLM is still streaming; disables interactions while true. */
  isStreaming?: boolean;
  /** Callback when a component triggers a host action. */
  onAction?: (event: ActionEvent) => void;
  /** Called whenever $variables or form state changes. */
  onStateUpdate?: (state: Record<string, unknown>) => void;
  /** Initial persisted state. $-prefixed keys hydrate reactive bindings. */
  initialState?: Record<string, unknown>;
  /** Called whenever the raw parse result changes. */
  onParseResult?: (result: ParseResult | null) => void;
  /** Tool provider for Query()/Mutation(): function map or MCP client. */
  toolProvider?: ToolProviderInput;
  /** Custom loading node shown while Query() calls are in flight. */
  queryLoader?: ReactNode;
  /** Structured parser/runtime/query errors for correction loops. */
  onError?: (errors: OpenUIError[]) => void;
}

export interface OpenUiRendererParsedProps {
  /** Pre-parsed result. Kept for v0.1/static-render compatibility. */
  result: ParseResult | null;
  library: Library;
  onAction?: (event: ActionEvent) => void;
  isStreaming?: boolean;
}

export type OpenUiRendererProps =
  | OpenUiRendererRuntimeProps
  | OpenUiRendererParsedProps;

interface FieldEntry {
  value: unknown;
  componentType?: string;
}

type FormStateValue = FieldEntry | Record<string, FieldEntry>;
type FormState = Record<string, FormStateValue>;

function isElementNode(value: unknown): value is ElementNode {
  return (
    typeof value === 'object'
    && value !== null
    && 'type' in value
    && 'typeName' in value
    && (value as Record<string, unknown>)['type'] === 'element'
  );
}

function createFieldEntry(
  value: unknown,
  componentType: string | undefined,
): FieldEntry {
  return componentType === undefined ? { value } : { value, componentType };
}

function isFieldEntry(value: unknown): value is FieldEntry {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && 'value' in value
  );
}

function isFieldMap(value: unknown): value is Record<string, FieldEntry> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value).every((entry) => isFieldEntry(entry))
  );
}

function getFieldEntry(
  state: FormState,
  formName: string | undefined,
  name: string,
): FieldEntry | undefined {
  if (!formName) {
    const value = state[name];
    return isFieldEntry(value) ? value : undefined;
  }

  const formValue = state[formName];
  if (!isFieldMap(formValue)) return undefined;
  return formValue[name];
}

function renderDeep(value: unknown): ReactNode {
  if (value === null || value === undefined) return null;

  if (
    typeof value === 'string' || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return <text>{String(value)}</text>;
  }

  if (Array.isArray(value)) {
    return value.map((v, i) => (
      <Fragment key={keyFrom(v, i)}>
        {renderDeep(v)}
      </Fragment>
    ));
  }

  if (isElementNode(value)) {
    const stableKey = value.statementId ?? keyFrom(value);
    return <RenderNode key={stableKey} node={value} />;
  }

  return null;
}

function RenderNode({ node }: { node: ElementNode }) {
  const { library, reportError } = useOpenUI();
  const Comp = library.components[node.typeName]?.component as
    | ComponentRenderer<any>
    | undefined;

  if (!Comp) return null;

  try {
    return <RenderNodeInner el={node} Comp={Comp} />;
  } catch (error) {
    reportError?.({
      source: 'runtime',
      code: 'render-error',
      component: node.typeName,
      message: `Component ${node.typeName} render failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    return null;
  }
}

function RenderNodeInner(
  { el, Comp }: {
    el: ElementNode;
    Comp: ComponentRenderer<any>;
  },
) {
  const renderNode = useRenderNode();
  return (
    <Comp
      props={el.props}
      renderNode={renderNode}
      {...(el.statementId ? { statementId: el.statementId } : {})}
    />
  );
}

function DefaultQueryLoader() {
  return (
    <view className='OpenUIQueryLoader'>
      <view className='OpenUIQueryLoaderDot' />
    </view>
  );
}

function RuntimeOpenUiRenderer(
  {
    response,
    library,
    isStreaming = false,
    onAction,
    onStateUpdate,
    initialState,
    onParseResult,
    toolProvider,
    queryLoader,
    onError,
  }: OpenUiRendererRuntimeProps,
) {
  const onParseResultRef = useRef(onParseResult);
  onParseResultRef.current = onParseResult;

  const toolProviderInputRef = useRef(toolProvider);
  toolProviderInputRef.current = toolProvider;

  const stableToolProvider = useRef<ToolProvider>({
    async callTool(
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<unknown> {
      const current = toolProviderInputRef.current ?? null;
      if (current === null) {
        throw new Error('[openui] toolProvider is null');
      }

      if (typeof (current as McpClientLike).callTool === 'function') {
        const result = await (current as McpClientLike).callTool({
          name: toolName,
          arguments: args,
        });
        return extractToolResult(result);
      }

      const map = current as Record<
        string,
        (a: Record<string, unknown>) => unknown
      >;
      const fn = map[toolName];
      if (!fn) throw new ToolNotFoundError(toolName, Object.keys(map));
      return await fn(args);
    },
  });
  const resolvedToolProvider =
    toolProvider !== null && toolProvider !== undefined
      ? stableToolProvider.current
      : null;

  const stateOptions = {
    response,
    library,
    isStreaming,
    toolProvider: resolvedToolProvider,
    ...(onAction ? { onAction } : {}),
    ...(onStateUpdate ? { onStateUpdate } : {}),
    ...(initialState ? { initialState } : {}),
    ...(onError ? { onError } : {}),
  };

  const { result, parseResult, contextValue, isQueryLoading } = useOpenUIState(
    stateOptions,
    renderDeep,
  );

  useEffect(() => {
    onParseResultRef.current?.(parseResult);
  }, [parseResult]);

  if (!result?.root) return null;

  return (
    <OpenUIContext.Provider value={contextValue}>
      <view className='OpenUIRenderer'>
        {isQueryLoading ? (queryLoader ?? <DefaultQueryLoader />) : null}
        <view
          className={isQueryLoading
            ? 'OpenUIRendererContent OpenUIRendererContentLoading'
            : 'OpenUIRendererContent'}
        >
          <RenderNode node={result.root} />
        </view>
      </view>
    </OpenUIContext.Provider>
  );
}

function ParsedOpenUiRenderer(
  {
    result,
    library,
    onAction,
    isStreaming = false,
  }: OpenUiRendererParsedProps,
) {
  const [formState, setFormState] = useState<FormState>({});
  const formStateRef = useRef(formState);
  const onActionRef = useRef(onAction);
  const store = useMemo<Store>(() => createStore(), []);

  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    return () => store.dispose();
  }, [store]);

  const getFieldValue = useCallback(
    (formName: string | undefined, name: string) => {
      return getFieldEntry(formStateRef.current, formName, name)?.value;
    },
    [formStateRef],
  );

  const setFieldValue = useCallback(
    (
      formName: string | undefined,
      componentType: string | undefined,
      name: string,
      value: unknown,
      _shouldTriggerSaveCallback: boolean = true,
    ) => {
      const currentState = formStateRef.current;
      const newState = { ...currentState };

      if (formName) {
        const currentFormValue = currentState[formName];
        newState[formName] = {
          ...(isFieldMap(currentFormValue) ? currentFormValue : {}),
          [name]: createFieldEntry(value, componentType),
        };
      } else {
        newState[name] = createFieldEntry(value, componentType);
        store.set(name, value);
      }

      setFormState(newState);
      formStateRef.current = newState;
    },
    [formStateRef, setFormState, store],
  );

  const triggerAction = useCallback(
    (
      userMessage: string,
      formName?: string,
      action?: ActionPlan | LegacyActionConfig,
    ) => {
      const currentState = formStateRef.current;
      const handler = onActionRef.current;

      // ActionPlan path (v0.5) — sequential steps
      if (action && 'steps' in action) {
        let relevantState: Record<string, unknown> | undefined;
        const formValue = formName ? currentState[formName] : undefined;
        if (formName && formValue !== undefined) {
          relevantState = { [formName]: formValue };
        } else if (Object.keys(currentState).length > 0) {
          relevantState = currentState;
        }

        for (const step of action.steps) {
          switch (step.type) {
            case ACTION_STEPS.ToAssistant:
              handler?.({
                type: BuiltinActionType.ContinueConversation,
                params: step.context ? { context: step.context } : {},
                humanFriendlyMessage: step.message,
                ...(relevantState ? { formState: relevantState } : {}),
                ...(formName ? { formName } : {}),
              });
              break;
            case ACTION_STEPS.OpenUrl:
              handler?.({
                type: BuiltinActionType.OpenUrl,
                params: { url: step.url },
                humanFriendlyMessage: '',
                ...(relevantState ? { formState: relevantState } : {}),
                ...(formName ? { formName } : {}),
              });
              break;
            case ACTION_STEPS.Run:
            case ACTION_STEPS.Set:
            case ACTION_STEPS.Reset:
              // OpenUiRenderer does not own the query manager, store, or
              // evaluation context needed to execute these steps. Report them
              // explicitly so generated plans do not fail silently here.
              console.warn(
                `[OpenUiRenderer] Unsupported ActionPlan step: ${step.type}`,
                step,
              );
              break;
            default:
              console.warn(
                '[OpenUiRenderer] Unknown ActionPlan step:',
                step,
              );
              break;
          }
        }
        return;
      }

      const legacyAction: LegacyActionConfig | undefined =
        action && !('steps' in action)
          ? action
          : undefined;
      const actionType = legacyAction?.type
        ?? BuiltinActionType.ContinueConversation;
      const actionParams = { ...(legacyAction?.params ?? {}) };
      if (legacyAction?.url) actionParams['url'] = legacyAction.url;
      if (legacyAction?.context) actionParams['context'] = legacyAction.context;

      let relevantState: Record<string, unknown> | undefined;
      const formValue = formName ? currentState[formName] : undefined;
      if (formName && formValue !== undefined) {
        relevantState = { [formName]: formValue };
      } else if (Object.keys(currentState).length > 0) {
        relevantState = currentState;
      }

      handler?.({
        type: actionType,
        params: actionParams,
        humanFriendlyMessage: userMessage,
        ...(relevantState ? { formState: relevantState } : {}),
        ...(formName ? { formName } : {}),
      });
    },
    [formStateRef, onActionRef],
  );

  const evaluationContext = useMemo<EvaluationContext>(
    () => ({
      getState: (name: string) => getFieldValue(undefined, name),
      resolveRef: () => undefined,
    }),
    [getFieldValue],
  );

  const contextValue = useMemo(
    () => ({
      library,
      renderNode: renderDeep,
      triggerAction,
      isStreaming,
      isQueryLoading: false,
      getFieldValue,
      setFieldValue,
      store,
      evaluationContext,
    }),
    [
      library,
      triggerAction,
      isStreaming,
      getFieldValue,
      setFieldValue,
      store,
      evaluationContext,
    ],
  );

  if (!result?.root) return null;

  return (
    <OpenUIContext.Provider value={contextValue}>
      <RenderNode node={result.root} />
    </OpenUIContext.Provider>
  );
}

export function OpenUiRenderer(props: OpenUiRendererProps) {
  if ('response' in props) {
    return <RuntimeOpenUiRenderer {...props} />;
  }
  return <ParsedOpenUiRenderer {...props} />;
}
