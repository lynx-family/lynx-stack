import { Buffer } from 'node:buffer';
import {
  _attributes,
  _children,
  innerHTML,
  type OffscreenDocument,
  type OffscreenElement,
} from '@lynx-js/offscreen-document/webworker';

type ShadowrootTemplates =
  | ((
    attributes: Record<string, string>,
  ) => string)
  | string;

function getInnerHTMLImpl(
  buffer: Buffer,
  offset: number,
  element: OffscreenElement,
  shadowrootTemplates: Record<string, ShadowrootTemplates>,
): number {
  const localName = element.localName;
  offset += buffer.write('<', offset, 'utf-8');
  offset += buffer.write(localName, offset, 'utf-8');
  for (const [key, value] of element[_attributes]) {
    offset += buffer.write(' ', offset, 'utf-8');
    offset += buffer.write(key, offset, 'utf-8');
    offset += buffer.write('="', offset, 'utf-8');
    offset += buffer.write(value, offset, 'utf-8');
    offset += buffer.write('"', offset, 'utf-8');
  }

  offset += buffer.write('>', offset, 'utf-8');
  const templateImpl = shadowrootTemplates[localName];
  if (templateImpl) {
    const template = typeof templateImpl === 'function'
      ? templateImpl(Object.fromEntries(element[_attributes].entries()))
      : templateImpl;
    offset += buffer.write('<template shadowrootmode="open">', offset, 'utf-8');
    offset += buffer.write(template, offset, 'utf-8');
    offset += buffer.write('</template>', offset, 'utf-8');
  }
  if (element[innerHTML]) {
    offset += buffer.write(element[innerHTML], offset, 'utf-8');
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
  offset += buffer.write('</', offset, 'utf-8');
  offset += buffer.write(localName, offset, 'utf-8');
  offset += buffer.write('>', offset, 'utf-8');
  return offset;
}

export function dumpHTMLString(
  buffer: Buffer,
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
