// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides a Button component for Vue in Lynx.
 */

import { defineComponent, h } from 'vue';

/**
 * Button component props
 */
export interface ButtonProps {
  /**
   * CSS class names
   */
  class?: string;
  /**
   * CSS style
   */
  style?: string | Record<string, string>;
  /**
   * Whether the button is disabled
   */
  disabled?: boolean;
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
   * On press in event handler
   */
  onPressIn?: (event: Event) => void;
  /**
   * On press out event handler
   */
  onPressOut?: (event: Event) => void;
}

/**
 * Button component
 */
export const Button = defineComponent({
  name: 'Button',
  props: {
    class: String,
    style: [String, Object],
    disabled: Boolean,
    'aria-label': String,
    role: String,
    onClick: Function,
    onPressIn: Function,
    onPressOut: Function,
  },
  setup(props, { slots }) {
    return () => h('button', props, slots['default']?.());
  },
});

/**
 * Default export
 */
export default Button; 
