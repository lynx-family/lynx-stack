// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Children } from 'react';
import type { PropsWithChildren } from 'react';

interface Props {
  titles: string[];
}

export function Columns({ children, titles = [] }: PropsWithChildren<Props>) {
  return (
    <div className='flex flex-wrap gap-4'>
      {Children.map(children, (child, index) => {
        return <Column title={titles[index]}>{child}</Column>;
      })}
    </div>
  );
}

interface ColumnProps {
  title?: string;
}

export function Column(
  { title, children }: PropsWithChildren<ColumnProps>,
) {
  return (
    <div className='w-80 flex-auto m-auto'>
      {title && <div className='font-bold text-center'>{title}</div>}
      {children}
    </div>
  );
}
