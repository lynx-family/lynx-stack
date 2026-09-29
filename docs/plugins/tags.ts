// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Converter } from 'typedoc';
import type { Application } from 'typedoc';

/** The tags `@lynx-js/type-config` marks the platforms of an option with. */
const PLATFORM_TAGS = new Set([
  '@android',
  '@ios',
  '@harmony',
  '@clayandroid',
  '@clayios',
  '@claymacos',
  '@claywindows',
]);

function isPlatformTag(tag: string): boolean {
  return PLATFORM_TAGS.has(tag.toLowerCase());
}

/**
 * Removes the platform tags of `@lynx-js/type-config`, which TypeDoc does not
 * know and would render as a section of its own. The text they carry, the
 * LynxSDK version of an option, stays as part of the description.
 */
export function hidePlatformTags(app: Application): void {
  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, context => {
    for (const reflection of Object.values(context.project.reflections)) {
      const comment = reflection.comment;
      if (!comment?.blockTags.some(tag => isPlatformTag(tag.tag))) continue;
      for (const tag of comment.blockTags) {
        if (!isPlatformTag(tag.tag)) continue;
        if (tag.content.every(part => part.text.trim() === '')) continue;
        comment.summary.push({ kind: 'text', text: '\n\n' }, ...tag.content);
      }
      comment.blockTags = comment.blockTags.filter(tag =>
        !isPlatformTag(tag.tag)
      );
    }
  });
}
