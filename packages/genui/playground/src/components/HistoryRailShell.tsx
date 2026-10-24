// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import { Button } from './Button.js';
import { MessageSquarePlus } from './Icon.js';
import { PageHeader } from './PageHeader.js';

export function HistoryRailShell(props: {
  ariaLabel: string;
  className: string;
  createLabel: string;
  count: number;
  disabled?: boolean;
  listClassName: string;
  onCreate: () => void;
  children: ReactNode;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className={props.className} aria-label={props.ariaLabel}>
      <div className='historyRailCreate'>
        <Button
          variant='secondary'
          size='lg'
          fullWidth
          iconBefore={MessageSquarePlus}
          disabled={props.disabled}
          onClick={props.onCreate}
        >
          {props.createLabel}
        </Button>
      </div>
      <PageHeader
        className='historyRailHeader'
        title='History'
        topContent={<span>{props.count}</span>}
      />
      <div className={props.listClassName}>
        {props.count > 0 ? props.children : props.empty}
      </div>
      {props.footer}
    </aside>
  );
}
