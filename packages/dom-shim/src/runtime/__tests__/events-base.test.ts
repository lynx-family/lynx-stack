// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import {
  EVENT_PHASE_NONE,
  ShimEvent,
  ShimKeyboardEvent,
  ShimMouseEvent,
} from '../events.ts';

describe('US-431 event base classes', () => {
  describe('ShimEvent', () => {
    it('initializes with sensible defaults', () => {
      const e = new ShimEvent('click');
      expect(e.type).toBe('click');
      expect(e.bubbles).toBe(true);
      expect(e.cancelable).toBe(true);
      expect(e.composed).toBe(false);
      expect(e.defaultPrevented).toBe(false);
      expect(e.eventPhase).toBe(EVENT_PHASE_NONE);
      expect(e.target).toBeNull();
      expect(e.currentTarget).toBeNull();
      expect(typeof e.timeStamp).toBe('number');
      expect(e.isTrusted).toBe(false);
    });

    it('init options override defaults', () => {
      const e = new ShimEvent('change', {
        bubbles: false,
        cancelable: false,
        composed: true,
      });
      expect(e.bubbles).toBe(false);
      expect(e.cancelable).toBe(false);
      expect(e.composed).toBe(true);
    });

    it('preventDefault sets defaultPrevented when cancelable', () => {
      const e = new ShimEvent('click');
      e.preventDefault();
      expect(e.defaultPrevented).toBe(true);
    });

    it('preventDefault is a no-op when not cancelable', () => {
      const e = new ShimEvent('click', { cancelable: false });
      e.preventDefault();
      expect(e.defaultPrevented).toBe(false);
    });

    it('stopPropagation flips _propagationStopped', () => {
      const e = new ShimEvent('click');
      expect(e._propagationStopped).toBe(false);
      e.stopPropagation();
      expect(e._propagationStopped).toBe(true);
      expect(e._immediatePropagationStopped).toBe(false);
    });

    it('stopImmediatePropagation flips both flags', () => {
      const e = new ShimEvent('click');
      e.stopImmediatePropagation();
      expect(e._propagationStopped).toBe(true);
      expect(e._immediatePropagationStopped).toBe(true);
    });

    it('composedPath returns empty when no target', () => {
      const e = new ShimEvent('click');
      expect(e.composedPath()).toEqual([]);
    });
  });

  describe('ShimMouseEvent', () => {
    it('exposes mouse fields', () => {
      const e = new ShimMouseEvent('click', {
        clientX: 100,
        clientY: 200,
        button: 0,
        buttons: 1,
      });
      expect(e.type).toBe('click');
      expect(e.clientX).toBe(100);
      expect(e.clientY).toBe(200);
      expect(e.button).toBe(0);
      expect(e.buttons).toBe(1);
      expect(e.bubbles).toBe(true);
    });

    it('defaults zero-fill', () => {
      const e = new ShimMouseEvent('mousedown');
      expect(e.clientX).toBe(0);
      expect(e.clientY).toBe(0);
      expect(e.button).toBe(0);
      expect(e.buttons).toBe(0);
    });
  });

  describe('ShimKeyboardEvent', () => {
    it('exposes keyboard fields and modifiers', () => {
      const e = new ShimKeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: true,
      });
      expect(e.type).toBe('keydown');
      expect(e.key).toBe('Enter');
      expect(e.code).toBe('Enter');
      expect(e.shiftKey).toBe(true);
      expect(e.metaKey).toBe(true);
    });

    it('defaults empty / false', () => {
      const e = new ShimKeyboardEvent('keyup');
      expect(e.key).toBe('');
      expect(e.code).toBe('');
      expect(e.shiftKey).toBe(false);
      expect(e.ctrlKey).toBe(false);
      expect(e.altKey).toBe(false);
      expect(e.metaKey).toBe(false);
    });
  });
});
