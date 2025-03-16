// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface MediaQueryStyle {
  query: string;
  styles: [string, string][];
}

export function transformMediaQueries(
  styles: [string, string][],
): MediaQueryStyle[] {
  const mediaQueries = new Map<string, [string, string][]>();
  const mediaQueryRegex = /^@media\s+(.+?)\s*{(.+)}$/;

  styles.forEach(([prop]) => {
    const match = prop.match(mediaQueryRegex);
    if (match && match[1] && match[2]) {
      const [, query, styleContent] = match;
      if (!mediaQueries.has(query)) {
        mediaQueries.set(query, []);
      }
      // Parse style content and add to the media query group
      const styleEntries = styleContent
        .split(';')
        .map(style => style.trim())
        .filter(Boolean)
        .map(style => {
          const [p, v] = style.split(':').map(s => s.trim());
          return [p || '', v || ''] as [string, string];
        });
      mediaQueries.get(query)?.push(...styleEntries);
    }
  });

  return Array.from(mediaQueries.entries()).map(([query, styles]) => ({
    query,
    styles,
  }));
}
