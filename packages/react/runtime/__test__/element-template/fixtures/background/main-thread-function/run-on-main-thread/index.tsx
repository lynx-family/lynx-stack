import { defineMainThreadObjectType, runOnMainThread, useMainThreadObject } from '@lynx-js/react';

interface AppProps {
  label?: string;
  source?: string;
}

export let lastRenderPromise: Promise<string> | undefined;

const config = { prefix: 'main' };

const formatterType = defineMainThreadObjectType({
  type: 'element-template-formatter',
  create: (prefix: string) => {
    'main thread';
    return {
      format(value: string) {
        return `${prefix}:${value}`;
      },
    };
  },
});

const echoOnMainThread = (value: string): string => {
  'main thread';
  return `${config.prefix}:${value}`;
};

export function callMainDirect(label = 'manual'): Promise<string> {
  return runOnMainThread(echoOnMainThread)(`direct:${label}`);
}

export function App({ label = 'first', source = 'render' }: AppProps) {
  const formatter = useMainThreadObject(formatterType, config.prefix);
  const formatOnMainThread = (value: string): string => {
    'main thread';
    // Capture the handle itself so this runtime fixture does not require
    // the separate compiler feature for narrowed member captures.
    const target = formatter;
    return target.format(value);
  };

  if (__BACKGROUND__) {
    lastRenderPromise = runOnMainThread(formatOnMainThread)(`${source}:${label}`);
  }
  return <view id={label} />;
}
