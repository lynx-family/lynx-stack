// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
interface GenericComponentProps {
  id?: string;
  sendAction?: (action: unknown) => void;
  surface: unknown;
}

type Binding = { path: string };
type BindableText = string | Binding;

/**
 * Props for the Chip catalog component.
 */
export interface ChipProps extends GenericComponentProps {
  /** Label text or a binding path. */
  label: BindableText;
  /**
   * Visual tone.
   * @defaultValue "primary"
   */
  tone?: 'primary' | 'secondary';
}

export function Chip(_props: ChipProps): null {
  return null;
}
