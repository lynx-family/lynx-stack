// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Resource as GenericResource } from './Resource.js';
import type { SignalStore } from './SignalStore.js';

export type SurfaceId = string;

/** Protocol versions understood by the renderer's core UI path. */
export type A2UIProtocolVersion = 'v0.9' | 'v1.0';

/** Minimal version-independent data-binding shape used by A2UI. */
export interface A2UIDataBinding {
  path: string;
}

/**
 * Function-call shape emitted by A2UI v1.0 agents.
 *
 * @inline
 */
export interface V1FunctionCall {
  call: string;
  args?: Record<string, unknown>;
  catalogId?: string;
}

/**
 * Permissive runtime function-call shape shared by v0.9 and v1.0 readers.
 *
 * `returnType` is retained only for reading v0.9 messages. New catalog
 * component contracts should use {@link V1FunctionCall} so their generated
 * schemas do not advertise this legacy field.
 */
export interface A2UIFunctionCall extends V1FunctionCall {
  returnType?:
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'object'
    | 'any'
    | 'void';
  [key: string]: unknown;
}

/** User interaction declared on a catalog component. */
export type A2UIAction =
  | {
    event: {
      name: string;
      context?: Record<string, unknown>;
      /** Optional renderer-to-agent text; may itself be a dynamic value. */
      userMessage?: unknown;
    };
  }
  | { functionCall: A2UIFunctionCall };

/**
 * A catalog-defined component instance. The protocol deliberately leaves
 * component-specific properties to the active catalog, so the renderer owns
 * only the common discriminator fields here.
 */
export interface ComponentInstance {
  id: string;
  component: string;
  catalogId?: string;
  /**
   * Absolute data context path for this component when created via a template.
   * Used for resolving relative bindings inside the component tree.
   */
  dataContextPath?: string;
  /**
   * Internal metadata for templated containers so we can re-expand on
   * data model updates.
   */
  __template?: {
    componentId: string;
    path: string;
  };
  [key: string]: unknown;
}

/**
 * In-memory state for a single protocol surface.
 */
export interface Surface {
  surfaceId: SurfaceId;
  catalogId?: string;
  theme?: Readonly<Record<string, unknown>>;
  sendDataModel?: boolean | undefined;
  /** id of the root component for this surface (must be 'root'). */
  rootComponentId?: string | null;
  components: Map<string, ComponentInstance>;
  resources: Map<string, Resource>;
  store: SignalStore;
}

/**
 * Payload carried by renderer resources when a surface or component changes.
 */
export interface ResourceInfo {
  /**
   * Internal event type emitted by the processor.
   */
  type: 'beginRendering' | 'surfaceUpdate' | 'deleteSurface';
  surfaceId: string;
  surface: Surface;
  component?: ComponentInstance;
}

export type Resource = GenericResource<ResourceInfo>;

interface MessageMetadata {
  /** Message id injected by the host/client. */
  messageId?: string;
}

export interface CreateSurfacePayload {
  surfaceId: string;
  catalogId?: string;
  /** v0.9-only input retained for backwards compatibility. */
  theme?: Readonly<Record<string, unknown>>;
  sendDataModel?: boolean;
  /** v1.0 can define the initial component tree inline. */
  components?: ComponentInstance[];
  /** v1.0 can define the initial root data model inline. */
  dataModel?: Record<string, unknown>;
  metadata?: Readonly<Record<string, unknown>>;
}

export type LegacyCreateSurfacePayload =
  & Omit<CreateSurfacePayload, 'components' | 'dataModel' | 'metadata'>
  & {
    components?: never;
    dataModel?: never;
    metadata?: never;
  };

export type V1CreateSurfacePayload = Omit<CreateSurfacePayload, 'theme'> & {
  theme?: never;
};

export interface UpdateComponentsPayload {
  surfaceId: string;
  components: ComponentInstance[];
}

export interface UpdateDataModelPayload {
  surfaceId: string;
  path?: string;
  /** Optional only so v0.9 delete messages remain readable. */
  value?: unknown;
}

export type V1UpdateDataModelPayload =
  & Omit<UpdateDataModelPayload, 'value'>
  & { value: unknown };

export interface DeleteSurfacePayload {
  surfaceId: string;
}

/** v0.9 messages; an omitted version remains readable for legacy callers. */
export type LegacyServerToClientMessage =
  & MessageMetadata
  & { version?: 'v0.9' }
  & (
    | { createSurface: LegacyCreateSurfacePayload }
    | { updateComponents: UpdateComponentsPayload }
    | { updateDataModel: UpdateDataModelPayload }
    | { deleteSurface: DeleteSurfacePayload }
  );

/** Strict core rendering subset of the A2UI v1.0 server-to-client schema. */
export type V1ServerToClientMessage =
  & MessageMetadata
  & { version: 'v1.0' }
  & (
    | { createSurface: V1CreateSurfacePayload }
    | { updateComponents: UpdateComponentsPayload }
    | { updateDataModel: V1UpdateDataModelPayload }
    | { deleteSurface: DeleteSurfacePayload }
  );

/** Core render messages accepted from both A2UI v0.9 and v1.0 streams. */
export type ServerToClientMessage =
  | LegacyServerToClientMessage
  | V1ServerToClientMessage;

/**
 * Normalized user action forwarded from rendered catalog components to the
 * host application.
 */
export interface UserActionPayload {
  name: string;
  userMessage?: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string; // ISO 8601
  context: Record<string, unknown>;
}

export type A2UIClientEventMessage =
  | string
  | {
    text?: string;
    sessionId?: string;
  }
  | {
    version: 'v1.0';
    action: UserActionPayload;
    sessionId?: string;
  }
  | {
    /** @deprecated Read compatibility for the pre-v1 internal envelope. */
    userAction: UserActionPayload;
    sessionId?: string;
  };

/**
 * Common runtime props passed to every catalog component by the renderer.
 */
export interface GenericComponentProps {
  id?: string;
  surface: Surface;
  setValue?: (key: string, value: unknown) => void;
  sendAction?: (action: Record<string, unknown>) => void;
  dataContextPath?: string;
  [key: string]: unknown;
}
