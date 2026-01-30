// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
declare class ElementNode {}

declare const __MAIN_THREAD__: boolean;

declare function __AddInlineStyle(
  e: ElementNode,
  key: number | string,
  value: string,
): void;

declare function __FlushElementTree(element?: ElementNode): void;

declare function __GetAttributeByName(
  e: ElementNode,
  name: string,
): undefined | string;

declare function __GetAttributeNames(e: ElementNode): string[];

declare function __GetPageElement(): ElementNode;

declare function __InvokeUIMethod(
  e: ElementNode,
  method: string,
  params: Record<string, unknown>,
  callback: (res: { code: number; data: unknown }) => void,
): ElementNode[];

declare function __LoadLepusChunk(
  name: string,
  cfg: { chunkType: number; dynamicComponentEntry?: string | undefined },
): boolean;

declare function __QuerySelector(
  e: ElementNode,
  cssSelector: string,
  params: {
    onlyCurrentComponent?: boolean;
  },
): ElementNode | undefined;

declare function __QuerySelectorAll(
  e: ElementNode,
  cssSelector: string,
  params: {
    onlyCurrentComponent?: boolean;
  },
): ElementNode[];

declare function __SetAttribute(
  e: ElementNode,
  key: string,
  value: unknown,
): void;

declare function __GetComputedStyleByKey(e: ElementNode, key: string): string;
/**
 * Animation operation types for ElementAnimate function
 */
declare enum AnimationOperation {
  START = 0, // Start a new animation
  PLAY = 1, // Play/resume a paused animation
  PAUSE = 2, // Pause an existing animation
  CANCEL = 3, // Cancel an animation
}

/**
 * Animation timing options configuration
 */
interface AnimationTimingOptions {
  name?: string; // Animation name (optional, auto-generated if not provided)
  duration?: number | string; // Animation duration
  delay?: number | string; // Animation delay
  iterationCount?: number | string; // Number of iterations (can be 'infinite')
  fillMode?: string; // Animation fill mode
  timingFunction?: string; // Animation timing function
  direction?: string; // Animation direction
}

/**
 * Keyframe definition for animation
 */
type Keyframe = Record<string, string | number>;

/**
 * ElementAnimate function - controls animations on DOM elements
 * @param element - The DOM element to animate (FiberElement reference)
 * @param args - Animation configuration array
 * @returns undefined
 */
declare function __ElementAnimate(
  element: ElementNode,
  args: [
    operation: AnimationOperation, // Animation operation type
    name: string, // Animation name
    keyframes: Keyframe[], // Array of keyframes
    options?: AnimationTimingOptions, // Timing and configuration options
  ] | [
    operation:
      | AnimationOperation.PAUSE
      | AnimationOperation.PLAY
      | AnimationOperation.CANCEL,
    name: string, // Animation name to pause/play
  ],
): void;
