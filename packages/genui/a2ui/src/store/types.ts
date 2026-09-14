// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import type { Resource as GenericResource } from './Resource.js';
import type { SignalStore } from './SignalStore.js';

export type SurfaceId = string;

export type ComponentInstance = v0_9.AnyComponent & {
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
    componentId: v0_9.ComponentId;
    path: string;
  };
};

/**
 * In-memory state for a single protocol surface.
 */
export interface Surface {
  surfaceId: SurfaceId;
  version?: ProtocolVersion;
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

/** Supported wire protocol versions. */
export type ProtocolVersion = 'v0.9' | 'v0.9.1' | 'v1.0';

/** Catalog-qualified function invocation. */
export interface ProtocolFunctionCall {
  call: string;
  /** Legacy v0.9 annotation; v1.0 infers return types from the catalog. */
  returnType?: string;
  catalogId?: string;
  args?: Record<string, unknown>;
}

/** Correlated result of a protocol function invocation. */
export type FunctionResponse =
  & { functionCallId: string }
  & (
    | { value: unknown; error?: never }
    | { error: { code: string; message: string }; value?: never }
  );

/** v1.0 messages, sharing the existing component representation. */
export type V1Message =
  & { version: 'v1.0' }
  & (
    | {
      createSurface: {
        surfaceId: string;
        catalogId?: string;
        sendDataModel?: boolean;
        components?: ComponentInstance[];
        dataModel?: Record<string, unknown>;
      };
    }
    | {
      updateComponents: { surfaceId: string; components: ComponentInstance[] };
    }
    | { updateDataModel: { surfaceId: string; path?: string; value: unknown } }
    | { deleteSurface: { surfaceId: string } }
    | {
      callRendererFunction: {
        functionCallId: string;
        callFunction: ProtocolFunctionCall & { catalogId: string };
      };
    }
    | { agentFunctionResponse: FunctionResponse }
  );

export type ServerToClientMessage = (v0_9.A2uiMessage | V1Message) & {
  /** Message id injected by the client. */
  messageId?: string;
};

/** Renderer-to-agent v1.0 wire envelope. Transport metadata is separate. */
export type RendererToAgentMessage =
  & { version: 'v1.0' }
  & (
    | { action: UserActionPayload }
    | {
      callAgentFunction: {
        surfaceId: string;
        functionCallId: string;
        callFunction: ProtocolFunctionCall;
      };
    }
    | { rendererFunctionResponse: FunctionResponse }
    | {
      error: {
        code: string;
        message: string;
        functionCallId?: string;
        surfaceId?: string;
      };
    }
  );

/**
 * Normalized user action forwarded from rendered catalog components to the
 * host application.
 */
export interface UserActionPayload {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string; // ISO 8601
  context: Record<string, unknown>;
}

export type A2UIClientEventMessage =
  | RendererToAgentMessage
  | string
  | {
    text?: string;
    sessionId?: string;
  }
  | {
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
