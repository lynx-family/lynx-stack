// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ReflectionKind, RendererEvent } from 'typedoc';
import type { Application } from 'typedoc';

/**
 * Names a module after the package that re-exports it, so a reader sees the
 * package they install rather than the one its API is written in. The names
 * are renamed once the projects are merged, before the pages are rendered,
 * so the titles, the links and the references all follow.
 */
export function renameWrappedPackages(
  app: Application,
  wrappers: Record<string, string>,
): void {
  app.renderer.on(RendererEvent.BEGIN, (event: RendererEvent) => {
    for (const reflection of Object.values(event.project.reflections)) {
      const wrapper = wrappers[reflection.name];
      if (
        wrapper
        && reflection.kindOf(ReflectionKind.Module | ReflectionKind.Project)
      ) {
        reflection.name = wrapper;
      }
    }
    if (wrappers[event.project.name]) {
      event.project.name = wrappers[event.project.name]!;
    }
  });
}
