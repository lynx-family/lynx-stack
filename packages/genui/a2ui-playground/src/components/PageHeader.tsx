// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import './PageHeader.css';

interface PageHeaderProps {
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  topContent?: ReactNode;
}

function joinClassNames(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export function PageHeader(props: PageHeaderProps) {
  const {
    className,
    titleClassName,
    descriptionClassName,
    title,
    description,
    topContent,
  } = props;

  return (
    <header className={joinClassNames('pageHeader', className)}>
      <div className='pageHeaderTop'>
        <h2 className={joinClassNames('pageHeaderTitle', titleClassName)}>
          {title}
        </h2>
        {topContent
          ? <div className='pageHeaderTopContent'>{topContent}</div>
          : null}
      </div>
      {description === undefined
        ? null
        : (
          <p
            className={joinClassNames(
              'pageHeaderDescription',
              descriptionClassName,
            )}
          >
            {description}
          </p>
        )}
    </header>
  );
}
