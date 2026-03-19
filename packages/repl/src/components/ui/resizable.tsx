/* eslint-disable headers/header-format, import/no-unresolved */
import { Group, Panel, Separator } from 'react-resizable-panels';

import { cn } from '@/utils/cn';

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  const directionClass = props.orientation === 'vertical'
    ? 'flex flex-col'
    : 'flex flex-row';
  return (
    <Group
      className={cn('h-full w-full', directionClass, className)}
      {...props}
    />
  );
}

const ResizablePanel = Panel;

function ResizableHandle({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  // react-resizable-panels sets aria-orientation on Separator:
  //   "vertical"   → separator in a horizontal group (vertical line between L/R panels)
  //   "horizontal" → separator in a vertical group   (horizontal line between T/B panels)
  //
  // The handle is 1px in the layout (no gap between panels).
  // A ::before pseudo-element extends ±2px for a 5px hit area.
  return (
    <Separator
      className={cn(
        'resize-handle relative shrink-0 select-none touch-none z-10',
        '[&[aria-orientation=vertical]]:h-full [&[aria-orientation=vertical]]:w-px [&[aria-orientation=vertical]]:cursor-col-resize',
        '[&[aria-orientation=horizontal]]:w-full [&[aria-orientation=horizontal]]:h-px [&[aria-orientation=horizontal]]:cursor-row-resize',
        className,
      )}
      {...props}
    />
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
