// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useLang } from '@rspress/core/runtime';
import { HomeLayout as BaseHomeLayout } from '@rspress/core/theme-original';
import {
  containerStyle,
  innerContainerStyle,
} from '@rstack-dev/doc-ui/section-style';
import { ToolStack } from '@rstack-dev/doc-ui/tool-stack';

import { MeteorsBackground } from './meteors-background.js';

export const HomeLayout = () => {
  const lang = useLang();
  return (
    <>
      <MeteorsBackground gridSize={120} meteorCount={5} />
      <BaseHomeLayout
        afterFeatures={
          <section className={containerStyle}>
            <div className={innerContainerStyle}>
              <ToolStack lang={lang} />
            </div>
          </section>
        }
      />
    </>
  );
};
