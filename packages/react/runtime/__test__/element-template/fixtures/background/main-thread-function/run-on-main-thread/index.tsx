import { runOnMainThread } from '@lynx-js/react';

interface AppProps {
  label?: string;
  source?: string;
}

export let lastRenderPromise: Promise<string> | undefined;

const echoOnMainThread = (value: string): string => {
  'main thread';
  return `main:${value}`;
};

export function callMainDirect(label = 'manual'): Promise<string> {
  return runOnMainThread(echoOnMainThread)(`direct:${label}`);
}

export function App({ label = 'first', source = 'render' }: AppProps) {
  if (__BACKGROUND__) {
    lastRenderPromise = runOnMainThread(echoOnMainThread)(`${source}:${label}`);
  }
  return <view id={label} />;
}
