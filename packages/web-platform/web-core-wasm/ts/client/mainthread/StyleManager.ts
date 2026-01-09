// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { lynxUniqueIdAttribute } from '../../constants.js';
import type { DecodedStyle } from '../wasm.js';
// @ts-expect-error
import IN_SHADOW_CSS_MODERN from '../../../css/in_shadow.css?inline';

const IN_SHADOW_CSS = URL.createObjectURL(
  new Blob([IN_SHADOW_CSS_MODERN], { type: 'text/css' }),
);

const IMPORT_CSS_STMT = `@import url("${IN_SHADOW_CSS}");\n`;

/**
 * There are two modes to manage styles:
 * 1. CSS Selector mode: styles are injected into a <style>, the style manager won't keep track of which styles are applied to which elements.
 *    The browser's native CSS selector engine will handle the style application.
 * 2. Non-CSS Selector mode: styles are managed by the style manager, which keeps track of which styles are applied to which elements.
 *    The style manager will inject styles into the style sheet of a <style> element. All classes is calculated
 *    based on entry_name, css_id, class_name, and applied by using [unique-id="x"] selectors.
 */
export class StyleManager {
  #cssQueryMapByEntryName: Map<
    string,
    DecodedStyle
  > = new Map();
  #cssOGStyleSheet?: CSSStyleSheet;
  #uniqueIdToStyleDeclarationsMap?: Map<number, CSSStyleDeclaration>;
  readonly #rootNode: Node;

  constructor(rootNode: Node) {
    this.#rootNode = rootNode;
  }

  updateCssOgStyle(
    uniqueId: number,
    cssId: number,
    classNames: DOMTokenList,
    entryName: string = '__Card__',
  ) {
    const classNamesArray = [...classNames as unknown as string[]];
    const newDeclarations = this.#cssQueryMapByEntryName.get(entryName)
      ?.query_css_og_declarations_by_css_id(
        cssId,
        classNamesArray,
      ) ?? '';
    if (!this.#cssOGStyleSheet) {
      const cssOgStyleElement = document.createElement('style');
      this.#rootNode.appendChild(cssOgStyleElement);
      this.#cssOGStyleSheet = cssOgStyleElement.sheet as CSSStyleSheet;
    }

    // update style declaration
    if (this.#cssOGStyleSheet && this.#cssQueryMapByEntryName) {
      if (!this.#uniqueIdToStyleDeclarationsMap) {
        this.#uniqueIdToStyleDeclarationsMap = new Map();
      }

      const styleDeclaration = this.#uniqueIdToStyleDeclarationsMap.get(
        uniqueId,
      );
      if (styleDeclaration) {
        styleDeclaration.cssText = newDeclarations;
      } else {
        const ruleIndex = this.#cssOGStyleSheet.insertRule(
          `[${lynxUniqueIdAttribute}="${uniqueId}"] {${newDeclarations}}`,
          this.#cssOGStyleSheet.cssRules.length,
        );
        const rule = this.#cssOGStyleSheet.cssRules[ruleIndex] as CSSStyleRule;
        this.#uniqueIdToStyleDeclarationsMap.set(uniqueId, rule.style);
      }
    }
  }

  pushStyleSheet(decodedStyle: DecodedStyle, entryName?: string) {
    const newStyleElement = document.createElement('style');
    let styleElementContent = entryName ? '' : IMPORT_CSS_STMT;
    if (decodedStyle.style_content) {
      styleElementContent += decodedStyle.style_content;
      if (entryName) {
        newStyleElement.setAttribute('name', entryName);
      }
    }

    if (decodedStyle.font_face_content) {
      const fontFaceStyleElement = document.createElement('style');
      fontFaceStyleElement.textContent = decodedStyle.font_face_content;
      if (entryName) {
        fontFaceStyleElement.setAttribute('name', entryName);
      }
      this.#rootNode.parentElement!.appendChild(fontFaceStyleElement);
    }
    this.#cssQueryMapByEntryName.set(entryName || '__Card__', decodedStyle);

    newStyleElement.textContent = styleElementContent;
    this.#rootNode.appendChild(newStyleElement);
  }
}
