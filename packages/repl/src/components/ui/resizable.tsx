import {
  Group,
  Panel,
  Separator,
} from 'react-resizable-panels';

import { cn } from '@/lib/utils';

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  const directionClass = props.direction === 'vertical'
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
  return (
    <Separator
      className={cn(
        '[&[data-direction=horizontal]]:h-full [&[data-direction=horizontal]]:w-px',
        '[&[data-direction=vertical]]:h-px [&[data-direction=vertical]]:w-full',
        'bg-[var(--repl-border)] transition-colors hover:bg-[var(--repl-accent)]',
        '[&[data-separator=active]]:bg-[var(--repl-accent)]',
        className,
      )}
      {...props}
    />
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
