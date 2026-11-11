// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Converter } from 'typedoc';
import type { Application } from 'typedoc';

/**
 * TSDoc and API Extractor write a reference to another package as
 * `@scope/pkg#Member`, while TypeDoc reads `@scope/pkg!Member`.
 */
export function rewritePackageReferences(
  app: Application,
  hidden = new Set<string>(),
): void {
  const isHidden = (text: string) => {
    const target = /^(@[^/\s]+\/[^!#\s]+|[^!#\s]+)[!#]/.exec(text.trim());
    return !!target && hidden.has(target[1]!);
  };
  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, context => {
    for (const reflection of Object.values(context.project.reflections)) {
      const parts = [
        ...reflection.comment?.summary ?? [],
        ...reflection.comment?.blockTags.flatMap(tag => tag.content) ?? [],
      ];
      if (reflection.comment) {
        reflection.comment.blockTags = reflection.comment.blockTags.filter(
          tag =>
            tag.tag !== '@inheritDoc'
            || !isHidden(tag.content.map(part => part.text).join('')),
        );
      }
      for (const part of parts) {
        if (part.kind === 'inline-tag') {
          part.text = part.text.replace(/^(@[^/\s]+\/[^#\s:]+)#/, '$1!');
          if (
            ['@link', '@linkcode', '@linkplain', '@inheritDoc'].includes(
              part.tag,
            )
            && isHidden(part.text)
          ) {
            Object.assign(part, { kind: 'text', text: part.text });
          }
        }
      }
    }
  });
}
