// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  containerStyle,
  descStyle,
  innerContainerStyle,
  titleAndDescStyle,
  titleStyle,
} from '@rstack-dev/doc-ui/section-style';
import { ToolStack } from '@rstack-dev/doc-ui/tool-stack';
import { useI18n, useLang } from 'rspress/runtime';
import { HomeLayout as BaseHomeLayout } from 'rspress/theme';

import { MeteorsBackground } from './meteors-background.js';

export const HomeLayout = () => {
  const lang = useLang();
  const t = useI18n();
  return (
    <>
      <MeteorsBackground gridSize={120} meteorCount={5} />
      <BaseHomeLayout
        afterFeatures={
          <section className={containerStyle}>
            <div className={innerContainerStyle}>
              <div className={titleAndDescStyle}>
                <h1 className={titleStyle}>{t('toolStackTitle')}</h1>
                <p className={descStyle}>{t('toolStackDesc')}</p>
              </div>
              <ToolStack lang={lang} />
            </div>
          </section>
        }
      />
    </>
  );
};
