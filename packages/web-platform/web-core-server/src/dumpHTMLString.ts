import {
  _attributes,
  _children,
  innerHTML,
  type OffscreenDocument,
  type OffscreenElement,
} from '@lynx-js/offscreen-document/webworker';
import { write } from './createLynxView.js';

type ShadowrootTemplates =
  | ((
    attributes: Record<string, string>,
  ) => string)
  | string;

function getInnerHTMLImpl(
  buffer: Uint16Array,
  offset: number,
  element: OffscreenElement,
  shadowrootTemplates: Record<string, ShadowrootTemplates>,
): number {
  const localName = element.localName;
  offset += write(buffer, '<', offset);
  offset += write(buffer, localName, offset);
  for (const [key, value] of element[_attributes]) {
    offset += write(buffer, ' ', offset);
    offset += write(buffer, key, offset);
    offset += write(buffer, '="', offset);
    offset += write(buffer, value, offset);
    offset += write(buffer, '"', offset);
  }

  offset += write(buffer, '>', offset);
  const templateImpl = shadowrootTemplates[localName];
  if (templateImpl) {
    const template = typeof templateImpl === 'function'
      ? templateImpl(Object.fromEntries(element[_attributes].entries()))
      : templateImpl;
    offset += write(buffer, '<template shadowrootmode="open">', offset);
    offset += write(buffer, template, offset);
    offset += write(buffer, '</template>', offset);
  }
  if (element[innerHTML]) {
    offset += write(buffer, element[innerHTML], offset);
  } else {
    for (const child of element[_children]) {
      offset = getInnerHTMLImpl(
        buffer,
        offset,
        child as OffscreenElement,
        shadowrootTemplates,
      );
    }
  }
  offset += write(buffer, '</', offset);
  offset += write(buffer, localName, offset);
  offset += write(buffer, '>', offset);
  return offset;
}

export function dumpHTMLString(
  buffer: Uint16Array,
  offset: number,
  element: OffscreenDocument,
  shadowrootTemplates: Record<string, ShadowrootTemplates>,
): number {
  for (const child of element[_children]) {
    offset = getInnerHTMLImpl(
      buffer,
      offset,
      child as OffscreenElement,
      shadowrootTemplates,
    );
  }
  return offset;
}
