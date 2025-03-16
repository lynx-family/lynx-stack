// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createMediaQueryManager } from '../../utils/mediaQueries.js';
import { transformLynxStyles } from '../../../../web-style-transformer/src/index.js';

interface StyleRule {
  selector: string;
  styles: Record<string, string>;
  mediaQuery?: string;
}

interface TransformedMediaQuery {
  query: string;
  styles: [string, string][];
}

export class StyleManager {
  private styleSheet: CSSStyleSheet;
  private mediaQueryManager = createMediaQueryManager();
  private rules = new Map<string, CSSStyleRule>();
  private mediaQueryRules = new Map<string, Set<string>>();

  constructor() {
    const style = document.createElement('style');
    document.head.appendChild(style);
    this.styleSheet = style.sheet as CSSStyleSheet;
  }

  private applyMediaQueryStyles(
    selector: string,
    query: string,
    styles: [string, string][],
  ) {
    const mediaStyleText = styles
      .map(([prop, val]) => `${prop}: ${val};`)
      .join(' ');

    const mediaRuleText =
      `@media ${query} { ${selector} { ${mediaStyleText} } }`;
    const ruleIndex = this.styleSheet.insertRule(
      mediaRuleText,
      this.styleSheet.cssRules.length,
    );
    const ruleKey = `${selector}-${query}`;

    this.rules.set(
      ruleKey,
      this.styleSheet.cssRules[ruleIndex] as CSSStyleRule,
    );

    if (!this.mediaQueryRules.has(query)) {
      this.mediaQueryRules.set(query, new Set());
    }
    this.mediaQueryRules.get(query)?.add(ruleKey);

    this.mediaQueryManager.subscribe(query, (matches) => {
      const rule = this.rules.get(ruleKey);
      if (rule) {
        rule.style.display = matches ? '' : 'none';
      }
    });
  }

  addRule({ selector, styles, mediaQuery }: StyleRule) {
    const styleEntries = Object.entries(styles);
    const { transformedStyle, mediaQueries } = transformLynxStyles(
      styleEntries,
    );

    // Base styles
    const baseStyleText = transformedStyle
      .map(([prop, val]) => `${prop}: ${val};`)
      .join(' ');

    const baseRuleText = `${selector} { ${baseStyleText} }`;

    if (mediaQuery) {
      this.applyMediaQueryStyles(selector, mediaQuery, transformedStyle);
    } else {
      const ruleIndex = this.styleSheet.insertRule(
        baseRuleText,
        this.styleSheet.cssRules.length,
      );
      this.rules.set(
        selector,
        this.styleSheet.cssRules[ruleIndex] as CSSStyleRule,
      );
    }

    // Apply transformed media queries
    mediaQueries.forEach((mq: TransformedMediaQuery) => {
      this.applyMediaQueryStyles(selector, mq.query, mq.styles);
    });
  }

  updateRule({ selector, styles, mediaQuery }: StyleRule) {
    const key = mediaQuery ? `${selector}-${mediaQuery}` : selector;
    const rule = this.rules.get(key);

    if (rule) {
      Object.entries(styles).forEach(([prop, value]) => {
        rule.style.setProperty(prop, value);
      });
    } else {
      this.addRule({ selector, styles, mediaQuery });
    }
  }

  removeRule(selector: string, mediaQuery?: string) {
    const key = mediaQuery ? `${selector}-${mediaQuery}` : selector;
    const rule = this.rules.get(key);

    if (rule) {
      const index = Array.from(this.styleSheet.cssRules).indexOf(rule);
      if (index !== -1) {
        this.styleSheet.deleteRule(index);
        this.rules.delete(key);
      }
    }
  }

  dispose() {
    this.mediaQueryRules.forEach((rules, query) => {
      rules.forEach(ruleKey => {
        const rule = this.rules.get(ruleKey);
        if (rule) {
          const index = Array.from(this.styleSheet.cssRules).indexOf(rule);
          if (index !== -1) {
            this.styleSheet.deleteRule(index);
          }
        }
      });
    });

    this.rules.clear();
    this.mediaQueryRules.clear();
    this.styleSheet.ownerNode?.remove();
  }
}
