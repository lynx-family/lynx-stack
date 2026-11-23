// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { bindPage } from '../../src/bts.js';

type Data = Record<string, unknown>;

export interface RenderSink {
  render(data: Readonly<Data>, globalProps: Readonly<Data>): void;
  destroy(): void;
}

/** A small adopter with its own state policy and no dependency on React or host wiring. */
export function startIndependentDSL(sink: RenderSink): void {
  const page = bindPage();
  let data = { ...page.getInitData() };
  let globalProps = { ...page.getGlobalProps() };
  const render = (): void => sink.render(data, globalProps);

  page.onUpdateData((patch, options) => {
    // This DSL replaces its entire state on reset and merges incremental updates.
    data = options.resetPageData ? { ...patch } : { ...data, ...patch };
    render();
  });
  page.onReload(() => {
    data = { ...page.getInitData() };
    render();
  });
  page.onGlobalPropsChanged((next) => {
    globalProps = { ...next };
    render();
  });
  page.onDestroy(() => sink.destroy());
  render();
}
