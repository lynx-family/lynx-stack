import {
  _attributes,
  _children,
  textContent,
  _cssRuleContents,
  type OffscreenDocument,
  type OffscreenElement,
} from '@lynx-js/offscreen-document/webworker';
import { escapeHtml } from './utils/escapeHtml.js';
import {
  lynxPartIdAttribute,
  lynxUniqueIdAttribute,
} from '@lynx-js/web-constants';

type ShadowrootTemplates =
  | ((
    attributes: Record<string, string>,
  ) => string)
  | string;

function getTextContentImpl(
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
    if (value.length > 0) {
      buffer.push('="');
      buffer.push(escapeHtml(value));
      buffer.push('"');
    }
  }

  const partId = element[_attributes].get(lynxPartIdAttribute)
    ?? element[_attributes].get(lynxUniqueIdAttribute)!;
  buffer.push(' ', lynxPartIdAttribute, '="', partId, '"');

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
  if (element[textContent]) {
    buffer.push(element[textContent]);
  } else {
    for (const child of element[_children]) {
      getTextContentImpl(
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
    getTextContentImpl(
      buffer,
      child as OffscreenElement,
      shadowrootTemplates,
    );
  }
}
