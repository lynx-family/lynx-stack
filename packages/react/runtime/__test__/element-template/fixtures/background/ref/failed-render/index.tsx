import type { ReactNode } from 'react';

interface AppProps {
  hostRef?: unknown;
  children?: ReactNode;
}

export function App({ hostRef, children }: AppProps) {
  return <view ref={hostRef}>{children}</view>;
}
