export const getCombinedDirectParentElement = <T extends HTMLElement>(
  element: HTMLElement,
  parentTagName: string,
): T | undefined => {
  let parentElement: T | null = element.parentElement as T | null;
  if (parentElement?.tagName === 'LYNX-WRAPPER') {
    parentElement = parentElement.parentElement as T | null;
  }
  if (parentElement?.tagName === parentTagName) {
    return parentElement;
  }
  return;
};
