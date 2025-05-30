// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides a Text component for Vue in Lynx.
 */

import { defineComponent, h } from 'vue';

/**
 * Text component props
 */
export interface TextProps {
  /**
   * CSS class names
   */
  class?: string;
  /**
   * CSS style
   */
  style?: string | Record<string, string>;
  /**
   * Number of lines to show
   */
  numberOfLines?: number;
  /**
   * Whether to selectable
   */
  selectable?: boolean;
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
}

/**
 * Text component
 */
export const Text = defineComponent({
  name: 'Text',
  props: {
    class: String,
    style: [String, Object],
    numberOfLines: Number,
    selectable: Boolean,
    'aria-label': String,
    role: String,
    onClick: Function,
  },
  setup(props, { slots }) {
    return () => h('text', props, slots['default']?.());
  },
});

/**
 * Default export
 */
export default Text; 
