// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ActionEvent,
  ActionPlan,
  ElementNode,
  EvaluationContext,
  ParseResult,
  Store,
} from '@openuidev/lang-core';
import { BuiltinActionType } from '@openuidev/lang-core';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';

import { OpenUIContext } from './context.js';
import type { Library, RenderOutput } from './library.js';
import { keyFrom } from './utils.js';
import type { LegacyActionConfig } from '../catalog/Action/index.jsx';

import './renderer.css';

export type { Library, RenderOutput };

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

function renderValue(
  value: unknown,
  library: Library,
  onAction?: (event: ActionEvent) => void,
): RenderOutput {
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
        {renderValue(v, library, onAction)}
      </Fragment>
    ));
  }

  if (isElementNode(value)) {
    const stableKey = value.statementId ?? keyFrom(value);
    return (
      <RenderNode
        key={stableKey}
        stableKey={stableKey}
        node={value}
        library={library}
        {...(onAction ? { onAction } : {})}
      />
    );
  }

  return null;
}

function RenderNode(
  props: {
    key?: string;
    stableKey?: string;
    node: ElementNode;
    library: Library;
    onAction?: (event: ActionEvent) => void;
  },
) {
  const { stableKey, node, library, onAction } = props;
  const Comp = library.components[node.typeName]?.component;

  if (!Comp) return null;

  const renderNode = (value: unknown) => renderValue(value, library, onAction);

  return (
    <Comp
      key={stableKey}
      props={node.props}
      renderNode={renderNode}
      {...(onAction ? { onAction } : {})}
    />
  );
}

export function OpenUiRenderer(props: {
  result: ParseResult | null;
  library: Library;
  onAction?: (event: ActionEvent) => void;
  isStreaming?: boolean;
}) {
  const { result, library, onAction, isStreaming = false } = props;
  const [formState, setFormState] = useState<FormState>({});
  const formStateRef = useRef(formState);
  const onActionRef = useRef(onAction);

  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

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
      }

      setFormState(newState);
      formStateRef.current = newState;
    },
    [formStateRef, setFormState],
  );

  const triggerAction = useCallback(
    (
      userMessage: string,
      formName?: string,
      action?: ActionPlan | LegacyActionConfig,
    ) => {
      const currentState = formStateRef.current;
      const handler = onActionRef.current;

      const legacyAction: LegacyActionConfig | undefined =
        action && !('steps' in action)
          ? action
          : undefined;
      const actionType = legacyAction?.type
        ?? BuiltinActionType.ContinueConversation;
      const actionParams = legacyAction?.params ?? {};

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

  const renderNode = useCallback(
    (value: unknown) => renderValue(value, library, onAction),
    [library, onAction],
  );
  const contextValue = useMemo(
    () => ({
      library,
      renderNode,
      triggerAction,
      isStreaming,
      getFieldValue,
      setFieldValue,
      store: {} as Store,
      evaluationContext: {} as EvaluationContext,
    }),
    [
      library,
      renderNode,
      triggerAction,
      isStreaming,
      getFieldValue,
      setFieldValue,
    ],
  );

  if (!result?.root) return null;

  return (
    <OpenUIContext.Provider value={contextValue}>
      <RenderNode
        node={result.root}
        library={library}
        {...(onAction ? { onAction } : {})}
      />
    </OpenUIContext.Provider>
  );
}
