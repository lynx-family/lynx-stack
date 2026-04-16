import * as v0_9 from '@a2ui/web_core/v0_9';
import { SignalStore } from '../utils/SignalStore';

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

export interface ResourceInfo {
  /**
   * Internal event type emitted by the processor.
   */
  type: 'beginRendering' | 'surfaceUpdate' | 'deleteSurface';
  surfaceId: string;
  surface: Surface;
  component?: ComponentInstance;
}

export interface Resource {
  id: string;
  readonly completed: boolean;
  read: () => ResourceInfo;
  complete: (result: ResourceInfo) => void;
  onUpdate: (callback: (result: ResourceInfo) => void) => () => void;
  promise: Promise<ResourceInfo>;
}

export type ServerToClientMessage = v0_9.A2uiMessage & {
  /**
   * Message id injected by the client (SSE messageId / task id).
   */
  messageId?: string;
};

export interface UserActionPayload {
  name: string;
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
      userAction: UserActionPayload;
      sessionId?: string;
    };
