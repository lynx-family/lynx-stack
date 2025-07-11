import {
  _attributes,
  _children,
  innerHTML,
  _cssRuleContents,
  type OffscreenDocument,
  type OffscreenElement,
} from '@lynx-js/offscreen-document/webworker';
import { escapeHtml } from './utils/escapeHtml.js';

type ShadowrootTemplates =
  | ((
    attributes: Record<string, string>,
  ) => string)
  | string;

function getInnerHTMLImpl(
  buffer: string[],
  element: OffscreenElement,
  shadowrootTemplates: Record<string, ShadowrootTemplates>,
): void {
  const localName = element.localName;
  buffer.push('<');
  buffer.push(localName);
  for (const [key, value] of element[_attributes]) {
    buffer.push(' ');
    buffer.push(key);
    buffer.push('="');
    buffer.push(escapeHtml(value));
    buffer.push('"');
  }

  buffer.push('>');
  const templateImpl = shadowrootTemplates[localName];
  if (templateImpl) {
    const template = typeof templateImpl === 'function'
      ? templateImpl(Object.fromEntries(element[_attributes].entries()))
      : templateImpl;
    buffer.push('<template shadowrootmode="open">', template, '</template>');
  }
  if (element[_cssRuleContents]?.length) {
    buffer.push(...element[_cssRuleContents]);
  }
  if (element[innerHTML]) {
    buffer.push(element[innerHTML]);
  } else {
    for (const child of element[_children]) {
      getInnerHTMLImpl(
        buffer,
        child as OffscreenElement,
        shadowrootTemplates,
      );
    }
  }
  buffer.push('</');
  buffer.push(localName);
  buffer.push('>');
}

export function dumpHTMLString(
  buffer: string[],
  element: OffscreenDocument,
  shadowrootTemplates: Record<string, ShadowrootTemplates>,
): void {
  for (const child of element[_children]) {
    getInnerHTMLImpl(
      buffer,
      child as OffscreenElement,
      shadowrootTemplates,
    );
  }
}
