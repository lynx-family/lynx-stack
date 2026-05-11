// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  ACTION_STEPS,
  BuiltinActionType,
  createQueryManager,
  createStore,
  createStreamingParser,
  enrichErrors,
  evaluate,
  evaluateElementProps,
} from '@openuidev/lang-core';
import type {
  ActionEvent,
  ActionPlan,
  EvalContext,
  EvaluationContext,
  OpenUIError,
  ParseResult,
  QueryManager,
  Store,
  ToolProvider,
} from '@openuidev/lang-core';
import type React from 'react';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from '@lynx-js/react';

import type { LegacyActionConfig } from '../../catalog/Action/index.jsx';
import type { OpenUIContextValue } from '../context.js';
import type { Library } from '../library.js';

/** Unwrap { value, componentType } wrapper from form field entries. Returns raw value. */
function unwrapFieldValue(v: unknown): unknown {
  if (
    v
    && typeof v === 'object'
    && !Array.isArray(v)
    && 'value' in (v as Record<string, unknown>)
  ) {
    return (v as Record<string, unknown>)['value'];
  }
  return v;
}

function evaluateString(
  ast: Parameters<typeof evaluate>[0],
  evaluationContext: EvaluationContext,
): string {
  const evaluated = evaluate(ast, evaluationContext);
  return typeof evaluated === 'string' ? evaluated : '';
}

function evaluateNumber(
  ast: Parameters<typeof evaluate>[0],
  evaluationContext: EvaluationContext,
): number | undefined {
  const evaluated = evaluate(ast, evaluationContext);
  return typeof evaluated === 'number' ? evaluated : undefined;
}

function evaluateRecord(
  ast: Parameters<typeof evaluate>[0],
  evaluationContext: EvaluationContext,
): Record<string, unknown> {
  const evaluated = evaluate(ast, evaluationContext);
  return (
      typeof evaluated === 'object'
      && evaluated !== null
      && !Array.isArray(evaluated)
    )
    ? (evaluated as Record<string, unknown>)
    : {};
}

export interface UseOpenUIStateOptions {
  response: string | null;
  library: Library;
  isStreaming: boolean;
  onAction?: (event: ActionEvent) => void;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  initialState?: Record<string, unknown>;
  /** ToolProvider for Query data fetching — MCP, REST, GraphQL, or any backend. */
  toolProvider?: ToolProvider | null;
  /** Callback for structured, LLM-friendly errors. See OpenUIError type. */
  onError?: (errors: OpenUIError[]) => void;
}

export interface OpenUIState {
  /** Evaluated result (props resolved to concrete values). Used by Renderer. */
  result: ParseResult | null;
  /** Raw parse result (AST nodes in props). Used by onParseResult callback. */
  parseResult: ParseResult | null;
  contextValue: OpenUIContextValue;
  /** Whether any Query is currently fetching data. */
  isQueryLoading: boolean;
}

/**
 * Core state hook — extracts all form state, action handling, parser
 * management, and context assembly out of the Renderer component.
 *
 * Store holds everything: $bindings as top-level keys, form fields nested
 * under formName as plain values.
 */
export function useOpenUIState(
  {
    response,
    library,
    isStreaming,
    onAction,
    onStateUpdate,
    initialState,
    toolProvider,
    onError,
  }: UseOpenUIStateOptions,
  renderDeep: (value: unknown) => React.ReactNode,
): OpenUIState {
  // ─── Streaming parser (incremental — caches completed statements) ───
  const sp = useMemo(
    () => createStreamingParser(library.toJSONSchema(), library.root),
    [library],
  );

  // ─── Parse result ───
  const parseExceptionRef = useRef<OpenUIError | null>(null);
  const result = useMemo<ParseResult | null>(() => {
    parseExceptionRef.current = null;
    if (!response) return null;
    try {
      return sp.set(response);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      parseExceptionRef.current = {
        source: 'parser',
        code: 'parse-exception',
        message: `Parser crashed: ${msg}`,
        hint: 'The response may contain syntax the parser cannot handle',
      };
      return null;
    }
  }, [sp, response]);

  // ─── Store (holds everything: $bindings + form fields) ───
  const store = useMemo<Store>(() => createStore(), []);

  // ─── QueryManager ───
  const queryManager = useMemo<QueryManager>(
    () => createQueryManager(toolProvider ?? null),
    [toolProvider],
  );

  useEffect(() => {
    queryManager.activate();
    return () => queryManager.dispose();
  }, [queryManager]);

  // ─── Initialize Store ───
  const storeInitKeyRef = useRef<unknown>(Symbol());
  useEffect(() => {
    if (!result?.stateDeclarations && !initialState) return;
    const key = `${JSON.stringify(result?.stateDeclarations)}::${
      JSON.stringify(initialState)
    }`;
    if (storeInitKeyRef.current === key) return;
    storeInitKeyRef.current = key;

    // Split initialState: $-prefixed keys are bindings, everything else is form state
    const bindingDefaults: Record<string, unknown> = {};
    if (initialState) {
      for (const [key, value] of Object.entries(initialState)) {
        if (key.startsWith('$')) {
          bindingDefaults[key] = value;
        } else {
          // Form state — restore as-is (preserves { value, componentType } wrapper)
          store.set(key, value);
        }
      }
    }
    store.initialize(result?.stateDeclarations ?? {}, bindingDefaults);
  }, [result?.stateDeclarations, store, initialState]);

  // ─── Subscribe to Store and QueryManager for re-renders ───
  const storeSnapshot = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
  const querySnapshot = useSyncExternalStore(
    (listener) => queryManager.subscribe(listener),
    () => queryManager.getSnapshot(),
    () => queryManager.getSnapshot(),
  );

  // ─── Build EvaluationContext ───
  const evaluationContext = useMemo<EvaluationContext>(
    () => ({
      getState: (name: string) => unwrapFieldValue(store.get(name)),
      resolveRef: (name: string) => {
        const mutResult = queryManager.getMutationResult(name);
        if (mutResult) return mutResult;
        return queryManager.getResult(name);
      },
    }),
    [store, queryManager],
  );

  // ─── Evaluate and submit queries ───
  useEffect(() => {
    if (isStreaming) return;

    const queryStmts = result?.queryStatements ?? [];
    const evaluatedNodes = queryStmts.map((qn) => {
      const relevantDeps: Record<string, unknown> = {};
      if (qn.deps) {
        for (const ref of qn.deps) {
          relevantDeps[ref] = storeSnapshot[ref];
        }
      }
      const node: {
        statementId: string;
        toolName: string;
        args: unknown;
        defaults: unknown;
        deps: unknown;
        complete: boolean;
        refreshInterval?: number;
      } = {
        statementId: qn.statementId,
        toolName: qn.toolAST
          ? evaluateString(qn.toolAST, evaluationContext)
          : '',
        args: qn.argsAST ? evaluate(qn.argsAST, evaluationContext) : null,
        defaults: qn.defaultsAST
          ? evaluate(qn.defaultsAST, evaluationContext)
          : null,
        deps: Object.keys(relevantDeps).length > 0 ? relevantDeps : undefined,
        complete: qn.complete,
      };
      if (qn.refreshAST) {
        const interval = evaluateNumber(qn.refreshAST, evaluationContext);
        if (interval !== undefined) {
          node.refreshInterval = interval;
        }
      }
      return node;
    });

    // Always call — empty array clears removed queries and their errors
    queryManager.evaluateQueries(evaluatedNodes);
  }, [
    isStreaming,
    result?.queryStatements,
    evaluationContext,
    queryManager,
    storeSnapshot,
  ]);

  // ─── Register mutations ───
  useEffect(() => {
    if (isStreaming) return;

    const mutStmts = result?.mutationStatements ?? [];
    const nodes = mutStmts.map((mn) => ({
      statementId: mn.statementId,
      toolName: mn.toolAST ? evaluateString(mn.toolAST, evaluationContext) : '',
    }));
    // Always call — empty array clears removed mutations and their errors
    queryManager.registerMutations(nodes);
  }, [
    isStreaming,
    result?.mutationStatements,
    evaluationContext,
    queryManager,
  ]);

  // ─── Ref for stable callbacks ───
  const propsRef = useRef({ onAction, onStateUpdate, onError });
  propsRef.current = { onAction, onStateUpdate, onError };

  const resultRef = useRef(result);
  resultRef.current = result;

  // ─── Fire onStateUpdate when Store changes ───
  const lastInitSnapshotRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    lastInitSnapshotRef.current = store.getSnapshot();
    const unsub = store.subscribe(() => {
      const currentSnapshot = store.getSnapshot();
      if (currentSnapshot === lastInitSnapshotRef.current) return;
      lastInitSnapshotRef.current = null;
      propsRef.current.onStateUpdate?.(currentSnapshot);
    });
    return unsub;
  }, [store]);

  // ─── getFieldValue ───
  const getFieldValue = useCallback(
    (formName: string | undefined, name: string) => {
      if (!formName) return unwrapFieldValue(store.get(name));
      const formData = store.get(formName);
      if (
        !formData || typeof formData !== 'object' || Array.isArray(formData)
      ) return undefined;
      return unwrapFieldValue((formData as Record<string, unknown>)[name]);
    },
    [store],
  );

  // ─── setFieldValue ───
  const setFieldValue = useCallback(
    (
      formName: string | undefined,
      componentType: string | undefined,
      name: string,
      value: unknown,
      shouldTriggerSaveCallback: boolean = true,
    ) => {
      const wrapped = { value, componentType };
      if (formName) {
        const raw = store.get(formName);
        const formData = raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};
        store.set(formName, { ...formData, [name]: wrapped });
      } else {
        store.set(name, wrapped);
      }
      if (shouldTriggerSaveCallback) {
        propsRef.current.onStateUpdate?.(store.getSnapshot());
      }
    },
    [store],
  );

  // ─── Materialize form payload ───
  const getFormPayload = useCallback(
    (formName?: string): Record<string, unknown> | undefined => {
      if (formName) {
        const raw = store.get(formName);
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          return { [formName]: raw };
        }
      }
      return store.getSnapshot();
    },
    [store],
  );

  // ─── triggerAction ───
  const triggerAction = useCallback(
    async (
      userMessage: string,
      formName?: string,
      action?: ActionPlan | LegacyActionConfig,
    ) => {
      const formPayload = getFormPayload(formName);
      const { onAction: handler } = propsRef.current;

      function buildEvent(
        type: ActionEvent['type'],
        params: Record<string, unknown>,
        humanFriendlyMessage: string,
      ): ActionEvent {
        const event: ActionEvent = { type, params, humanFriendlyMessage };
        if (formPayload !== undefined) event.formState = formPayload;
        if (formName !== undefined) event.formName = formName;
        return event;
      }

      // Legacy action config path (v0.1 compat) — { type?, params? }
      if (action && !('steps' in action)) {
        const actionType = action.type
          ?? BuiltinActionType.ContinueConversation;
        const params = { ...(action.params ?? {}) };
        // v0.1 compat — url and context were top-level, not in params
        if (action.url) params['url'] = action.url;
        if (action.context) params['context'] = action.context;
        handler?.(buildEvent(actionType, params, userMessage));
        return;
      }

      // ActionPlan path (v0.5) — sequential steps with halt-on-mutation-failure
      const actionPlan = action;
      if (actionPlan?.steps) {
        for (const step of actionPlan.steps) {
          switch (step.type) {
            case ACTION_STEPS.Run: {
              if (step.refType === 'mutation') {
                const mn = resultRef.current?.mutationStatements?.find(
                  (m) => m.statementId === step.statementId,
                );
                const evaluatedArgs = mn?.argsAST
                  ? evaluateRecord(mn.argsAST, evaluationContext)
                  : {};
                const ok = await queryManager.fireMutation(
                  step.statementId,
                  evaluatedArgs,
                );
                if (!ok) return; // halt on failure
              } else {
                queryManager.invalidate([step.statementId]);
              }
              break;
            }
            case ACTION_STEPS.ToAssistant:
              handler?.(buildEvent(
                BuiltinActionType.ContinueConversation,
                step.context ? { context: step.context } : {},
                step.message,
              ));
              break;
            case ACTION_STEPS.OpenUrl:
              handler?.(buildEvent(
                BuiltinActionType.OpenUrl,
                { url: step.url },
                '',
              ));
              break;
            case ACTION_STEPS.Set: {
              const value = evaluate(step.valueAST, evaluationContext);
              store.set(step.target, value);
              break;
            }
            case ACTION_STEPS.Reset: {
              const decls = resultRef.current?.stateDeclarations ?? {};
              for (const target of step.targets) {
                store.set(target, decls[target] ?? null);
              }
              break;
            }
          }
        }
        return;
      }

      // Default — ContinueConversation with label
      handler?.(buildEvent(
        BuiltinActionType.ContinueConversation,
        {},
        userMessage,
      ));
    },
    [queryManager, evaluationContext, getFormPayload, store],
  );

  // ─── reportError (for error boundary) ───
  const renderErrorsRef = useRef<OpenUIError[]>([]);
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;
  const reportError = useCallback((error: OpenUIError) => {
    // Skip during streaming — render errors are transient and onError won't fire until streaming stops
    if (isStreamingRef.current) return;
    renderErrorsRef.current.push(error);
  }, []);

  // ─── Context value ───
  const contextValue = useMemo<OpenUIContextValue>(
    () => ({
      library,
      renderNode: renderDeep,
      triggerAction,
      isStreaming,
      getFieldValue,
      setFieldValue,
      store,
      evaluationContext,
      reportError,
    }),
    [
      library,
      renderDeep,
      isStreaming,
      triggerAction,
      getFieldValue,
      setFieldValue,
      store,
      evaluationContext,
      reportError,
    ],
  );

  // ─── Evaluate props ───
  const runtimeErrorsRef = useRef<OpenUIError[]>([]);

  const evaluatedResult = useMemo<ParseResult | null>(() => {
    if (!result?.root) return result;
    // Fresh errors array each pass — avoids mutating memoized context
    const errors: OpenUIError[] = [];
    const evalCtx: EvalContext = {
      ctx: evaluationContext,
      library,
      store,
      errors,
    };
    try {
      const evaluatedRoot = evaluateElementProps(result.root, evalCtx);
      runtimeErrorsRef.current = errors;
      return { ...result, root: evaluatedRoot };
    } catch (e) {
      // Safety net — per-prop catch in evaluateElementProps handles most cases
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({
        source: 'runtime',
        code: 'runtime-error',
        message: `Prop evaluation failed: ${msg}`,
      });
      runtimeErrorsRef.current = errors;
      return result;
    }
  }, [result, evaluationContext, library, store, storeSnapshot, querySnapshot]);

  const isQueryLoading = querySnapshot.__openui_loading.length > 0;

  // ─── Collect and fire onError ───
  const lastErrorKeyRef = useRef<string>('');
  useEffect(() => {
    if (isStreaming) {
      // Clear stale errors from previous session so the correction loop
      // gets a clean signal when this streaming session completes.
      if (lastErrorKeyRef.current !== '') {
        lastErrorKeyRef.current = '';
        propsRef.current.onError?.([]);
      }
      return;
    }
    const errors: OpenUIError[] = [];

    // Parser exception (parser itself crashed)
    if (parseExceptionRef.current) {
      errors.push(parseExceptionRef.current);
    }

    // Parse failure — response exists but produced no renderable root
    if (response && !result?.root && !parseExceptionRef.current) {
      errors.push({
        source: 'parser',
        code: 'parse-failed',
        message: result
          ? 'Code parsed but produced no renderable root component'
          : 'Response could not be parsed as valid openui-lang',
        hint:
          `The entire response must be valid openui-lang code starting with root = ${
            library.root ?? 'Root'
          }(...)`,
      });
    }

    // Parser validation errors → enriched OpenUIError (with hints)
    if (result?.meta?.errors?.length) {
      errors.push(
        ...enrichErrors(
          result.meta.errors,
          library.toJSONSchema(),
          Object.keys(library.components),
        ),
      );
    }

    // Runtime eval errors (collected per-prop by evaluateElementProps)
    errors.push(...runtimeErrorsRef.current);

    // Render errors (collected by error boundary via reportError)
    errors.push(...renderErrorsRef.current);
    renderErrorsRef.current = [];

    // Query/mutation tool errors — already OpenUIError, pass through directly
    errors.push(...(querySnapshot.__openui_errors ?? []));

    // Deduplicate — only fire when errors actually change
    const key = JSON.stringify(errors);
    if (key === lastErrorKeyRef.current) return;
    lastErrorKeyRef.current = key;

    // Fire onError or fall back to console.warn
    if (propsRef.current.onError) {
      propsRef.current.onError(errors);
    } else if (errors.length > 0) {
      for (const e of errors) {
        console.warn(`[openui] ${e.source}/${e.code}: ${e.message}`);
      }
    }
  }, [isStreaming, response, result, evaluatedResult, querySnapshot, library]);

  return {
    result: evaluatedResult,
    parseResult: result,
    contextValue,
    isQueryLoading,
  };
}
