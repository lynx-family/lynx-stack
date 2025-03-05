import type { LynxFiberElement } from '@lynx-js/lynx-dom';
import { TEXT_NODE } from './helpers';

function getNodeText(node: LynxFiberElement): string {
  if (
    node.matches('input[type=submit], input[type=button], input[type=reset]')
  ) {
    return (node as LynxFiberElement).value;
  }

  return Array.from(node.childNodes)
    .filter(child => child.nodeType === TEXT_NODE && Boolean(child.textContent))
    .map(c => c.textContent)
    .join('');
}

export { getNodeText };
