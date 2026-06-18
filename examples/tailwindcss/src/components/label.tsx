import type { ReactNode } from '@lynx-js/react';

export function Label(
  { children, className }: { children: ReactNode; className?: string },
) {
  return (
    <text
      className={`lynx-text-start lynx-text-blue-300 peer-ui-disabled:lynx-text-blue-950 ${className}`}
    >
      {children}
    </text>
  );
}
