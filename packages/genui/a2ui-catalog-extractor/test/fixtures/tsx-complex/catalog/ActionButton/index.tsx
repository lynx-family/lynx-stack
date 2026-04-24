// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
interface GenericComponentProps {
  id?: string;
  sendAction?: (action: unknown) => void;
  surface: unknown;
}

export interface ActionContextBinding {
  path: string;
}

export type ActionContextValue =
  | string
  | number
  | boolean
  | ActionContextBinding;

export interface ActionEvent {
  name: string;
  /** Context is a JSON object map in v0.9. */
  context?: Record<string, ActionContextValue>;
}

export interface ActionPayload {
  event: ActionEvent;
}

/**
 * Props for the ActionButton catalog component.
 */
export interface ActionButtonProps extends GenericComponentProps {
  /** Host action payload. */
  action: ActionPayload;
}

export function ActionButton(_props: ActionButtonProps): null {
  return null;
}
