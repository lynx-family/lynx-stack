// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { ErrorCode } from '../../../constants.js';
import { accessibilityAnnounceEndpoint } from '../../endpoints.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';

// Tracks the most recent pending announcement per announcer element, so two
// LynxView instances announcing concurrently never race each other's
// microtask (see the guard in the handler below).
const pendingAnnouncementId = new WeakMap<HTMLElement, number>();

/**
 * Lazily creates (and caches) a visually-hidden `aria-live` region inside the
 * LynxView's shadow root, so screen readers announce `lynx.accessibilityAnnounce()`
 * content the same way native platforms surface an accessibility announcement.
 */
function getAnnouncer(rootDom: ShadowRoot): HTMLElement {
  let announcer = rootDom.querySelector<HTMLElement>(
    '[data-lynx-accessibility-announcer]',
  );
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.setAttribute('data-lynx-accessibility-announcer', '');
    announcer.setAttribute('aria-live', 'assertive');
    announcer.setAttribute('aria-atomic', 'true');
    // Visually hidden but still exposed to accessibility tree ("sr-only").
    announcer.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    rootDom.append(announcer);
  }
  return announcer;
}

export function registerAccessibilityAnnounceHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
) {
  rpc.registerHandler(
    accessibilityAnnounceEndpoint,
    (content) => {
      const announcer = getAnnouncer(lynxViewInstance.rootDom);
      // Screen readers only fire a new announcement on a content *change*, so
      // repeating the same text back-to-back would otherwise be silently
      // dropped. Toggling through an empty state (a microtask apart) forces
      // the live region to re-announce every call, including repeats.
      announcer.textContent = '';
      const id = (pendingAnnouncementId.get(announcer) ?? 0) + 1;
      pendingAnnouncementId.set(announcer, id);
      queueMicrotask(() => {
        // Guard against a newer announce() call already overtaking this one.
        if (pendingAnnouncementId.get(announcer) === id) {
          announcer.textContent = content;
        }
      });
      return { code: ErrorCode.SUCCESS };
    },
  );
}
