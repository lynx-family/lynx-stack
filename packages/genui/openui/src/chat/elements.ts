// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
interface Child<P> {
  props?: Partial<P>;
  statementId?: string;
}

/** Read partial subcomponent props while their declaration is streaming. */
export function childProps<P>(node: unknown): Partial<P> {
  return node && typeof node === 'object' ? (node as Child<P>).props ?? {} : {};
}

export function childKey(node: unknown, index: number): string {
  const child = node as
    | Child<{ id: string; value: string; name: string }>
    | null;
  return child?.statementId ?? child?.props?.id ?? child?.props?.value
    ?? child?.props?.name ?? String(index);
}
