// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createContext, useMemo } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import type { Catalog, CatalogComponent } from '../catalog/defineCatalog.js';
import { resolveCatalog } from '../catalog/defineCatalog.js';
import type { MessageProcessor } from '../store/MessageProcessor.js';

/**
 * The context value `<A2UI>` provides to its catalog-component subtree.
 * Internal — neither the context nor the provider is part of the public
 * API. Catalog components reach this value via `useAction`,
 * `useDataBinding`, etc.
 */
export interface A2UIInternalContext {
  processor: MessageProcessor;
  catalog: Catalog;
  catalogMap: ReadonlyMap<string, CatalogComponent>;
}

export const A2UIContext = createContext<A2UIInternalContext | null>(null);

interface ProviderProps {
  processor: MessageProcessor;
  catalog: Catalog;
  children: ReactNode;
}

/**
 * Internal provider mounted by `<A2UI>`. Not exported from the package.
 */
export function A2UIProvider(
  props: ProviderProps,
): import('@lynx-js/react').ReactNode {
  const { processor, catalog, children } = props;
  const value = useMemo<A2UIInternalContext>(
    () => ({
      processor,
      catalog,
      catalogMap: resolveCatalog(catalog),
    }),
    [processor, catalog],
  );
  return <A2UIContext.Provider value={value}>{children}</A2UIContext.Provider>;
}
