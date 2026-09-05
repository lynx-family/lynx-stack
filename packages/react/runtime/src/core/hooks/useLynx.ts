// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Context } from 'preact';
import { createContext } from 'preact/compat';
import { useContext } from 'preact/hooks';

/**
 * Carries the `lynx` of the page a component is rendering in. Undefined for
 * cards that never called `createRenderContext`, which is every single-page
 * card.
 */
export const LynxContext: Context<unknown> = /*@__PURE__*/ createContext<unknown>(
  undefined,
);

/**
 * Reads the `lynx` of the page this component belongs to.
 *
 * Code in a chunk shared by several cards must not capture the module-scope
 * `lynx`: that one belongs to whichever card evaluated the chunk, and stops
 * working when that card is destroyed. Reading it per render through this
 * hook resolves to the page actually rendering.
 *
 * Falls back to the module-scope `lynx` when the tree has no render context,
 * so single-page cards behave as before.
 *
 * @example
 *
 * ```tsx
 * function Popup() {
 *   const lynx = useLynx()
 *   return <view style={{ height: lynx.__globalProps.screenHeight }} />
 * }
 * ```
 *
 * @public
 */
export function useLynx(): typeof lynx {
  // `preact/compat` and `preact/hooks` disagree on the Context type; the
  // runtime object is the same one.
  const value = useContext(
    LynxContext as unknown as Parameters<typeof useContext>[0],
  );
  return (value as typeof lynx | undefined) ?? lynx;
}
