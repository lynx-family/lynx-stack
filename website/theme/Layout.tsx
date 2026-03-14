// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useLang } from '@rspress/core/runtime';
import { Banner, Layout as BasicLayout } from '@rspress/core/theme-original';

export const Layout = () => {
  const lang = useLang();
  return (
    <BasicLayout
      beforeNav={
        <Banner
          href='https://lynxjs.org'
          storage={false}
          message={lang === 'en'
            ? 'This is the dev preview website. Check out the document at lynxjs.org'
            : '这是开发预览网站。请访问正式文档 lynxjs.org'}
        />
      }
    />
  );
};
