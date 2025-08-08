// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ForwardRefExoticComponent, PropsWithChildren, RefAttributes } from 'react';

// We use "@lynx-js/react" here
// because import * as ReactLynx from "@lynx-js/react/internal"; will be added when transform
// no matter if we use "@lynx-js/react" here
import { forwardRef, useEffect, useRef } from '@lynx-js/react';
import { __root, snapshotManager, updateSpread } from '@lynx-js/react/internal';

let pageMounted = false;

const Page: ForwardRefExoticComponent<Omit<PropsWithChildren, 'ref'> & RefAttributes<unknown>> =
  /* @__PURE__ */ (function() {
    if (__LEPUS__) {
      snapshotManager.values.get('root')!.update![0] = (snapshot, index, oldValue: Record<string, unknown>) => {
        /* v8 ignore start */
        if (__JS__ && !__DEV__) {
          return;
        }
        /* v8 ignore stop */
        updateSpread(snapshot, index, oldValue, 0);
      };
    }

    return forwardRef(
      function(props, ref) {
        const {
          children,
          ...restProps
        } = props;

        __root.setAttribute('values', [{
          ...ref ? { ref } : undefined,
          ...restProps,
          __spread: true,
        }]);
        const isFirstPageElement = useRef(true);

        useEffect(() => {
          if (pageMounted) {
            lynx.reportError(
              new Error(
                `Attempt to render more than one \`<page />\`, which is not supported.`,
              ),
            );
            isFirstPageElement.current = false;
          } else {
            pageMounted = true;
          }

          return () => {
            __root.setAttribute('values', [
              {
                ...Object.fromEntries(
                  Object.entries(restProps).map(([key, _val]) => {
                    return [key, undefined];
                  }),
                ),
                __spread: true,
              },
            ]);
            /* v8 ignore next */
            if (isFirstPageElement.current) pageMounted = false;
          };
        }, []);

        return children;
      },
    );
  })();

export { Page };
