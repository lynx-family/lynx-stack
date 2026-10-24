// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

import { Button } from '../../components/Button.js';
import { Info } from '../../components/Icon.js';
import { formatEstimatedCost } from '../../utils/modelPricing.js';
import './BenchCost.css';

const COST_DESCRIPTION =
  'Token and cost columns are averages per planned run. Estimated costs use saved model prices in CNY, include repairs, and exclude UI Judge. The total covers recorded runs only; missing usage or prices are unavailable.';

export function BenchCostLabel({ children }: { children: ReactNode }) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const openRef = useRef(false);

  useEffect(() => {
    const close = (event: Event) => {
      const popover = popoverRef.current;
      if (event.target instanceof Node && popover?.contains(event.target)) {
        return;
      }
      if (openRef.current) popover?.hidePopover();
    };
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, []);

  return (
    <span className='benchCostLabel'>
      {children}
      <span className='benchCostInfo' data-report-image-exclude>
        <Button
          ref={buttonRef}
          variant='ghost'
          size='sm'
          iconOnly
          iconBefore={Info}
          className='benchCostInfoButton'
          aria-label='Cost calculation details'
          aria-describedby={id}
          popoverTarget={id}
        />
        <span
          ref={popoverRef}
          id={id}
          popover='auto'
          className='benchCostPopover'
          onToggle={(event) => {
            openRef.current = event.newState === 'open';
            const popover = event.currentTarget;
            const anchor = buttonRef.current?.getBoundingClientRect();
            if (!anchor || !openRef.current) return;
            const { width, height } = popover.getBoundingClientRect();
            const gap = 8;
            const margin = 12;
            popover.style.left = `${
              Math.max(
                margin,
                Math.min(anchor.left, window.innerWidth - width - margin),
              )
            }px`;
            popover.style.top = `${
              Math.max(
                margin,
                Math.min(
                  anchor.bottom + gap + height <= window.innerHeight - margin
                    ? anchor.bottom + gap
                    : anchor.top - height - gap,
                  window.innerHeight - height - margin,
                ),
              )
            }px`;
          }}
        >
          {COST_DESCRIPTION}
        </span>
      </span>
    </span>
  );
}

export function BenchCost(
  { cost, average = false }: { cost: number | undefined; average?: boolean },
) {
  return (
    <span
      title={[
        `Estimated generation cost in CNY${
          average ? ' per planned run' : ' for recorded runs'
        }, including repairs. Excludes UI Judge.`,
        ...(cost === undefined
          ? ['A required token count or saved model price is missing.']
          : []),
      ].join('\n')}
    >
      {formatEstimatedCost(cost)}
    </span>
  );
}
