// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides a View component for Vue in Lynx.
 */

import { defineComponent, h } from 'vue';

/**
 * View component props
 */
export interface ViewProps {
  /**
   * CSS class names
   */
  class?: string;
  /**
   * CSS style
   */
  style?: string | Record<string, string>;
  /**
   * Accessibility label
   */
  'aria-label'?: string;
  /**
   * Accessibility role
   */
  role?: string;
  /**
   * On click event handler
   */
  onClick?: (event: Event) => void;
  /**
   * On touch start event handler
   */
  onTouchStart?: (event: Event) => void;
  /**
   * On touch move event handler
   */
  onTouchMove?: (event: Event) => void;
  /**
   * On touch end event handler
   */
  onTouchEnd?: (event: Event) => void;
}

/**
 * View component
 */
export const View = defineComponent({
  name: 'View',
  props: {
    class: String,
    style: [String, Object],
    'aria-label': String,
    role: String,
    onClick: Function,
    onTouchStart: Function,
    onTouchMove: Function,
    onTouchEnd: Function,
  },
  setup(props, { slots }) {
    return () => h('view', props, slots['default']?.());
  },
});

/**
 * Default export
 */
export default View; 
