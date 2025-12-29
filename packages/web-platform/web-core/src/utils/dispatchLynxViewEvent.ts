import type { CloneableObject } from '@lynx-js/web-constants';

export const dispatchLynxViewEvent = (
  shadowRoot: ShadowRoot,
  eventType: string,
  detail: CloneableObject | undefined,
) => {
  shadowRoot.dispatchEvent(
    new CustomEvent(eventType, {
      detail,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
};
