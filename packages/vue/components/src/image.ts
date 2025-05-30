// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides an Image component for Vue in Lynx.
 */

import { defineComponent, h } from 'vue';

/**
 * Image component props
 */
export interface ImageProps {
  /**
   * CSS class names
   */
  class?: string;
  /**
   * CSS style
   */
  style?: string | Record<string, string>;
  /**
   * Image source
   */
  src: string;
  /**
   * Image width
   */
  width?: number | string;
  /**
   * Image height
   */
  height?: number | string;
  /**
   * Resize mode
   */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
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
   * On load event handler
   */
  onLoad?: (event: Event) => void;
  /**
   * On error event handler
   */
  onError?: (event: Event) => void;
}

/**
 * Image component
 */
export const Image = defineComponent({
  name: 'Image',
  props: {
    class: String,
    style: [String, Object],
    src: {
      type: String,
      required: true,
    },
    width: [Number, String],
    height: [Number, String],
    resizeMode: String,
    'aria-label': String,
    role: String,
    onClick: Function,
    onLoad: Function,
    onError: Function,
  },
  setup(props, { slots }) {
    return () => h('image', props, slots['default']?.());
  },
});

/**
 * Default export
 */
export default Image; 
