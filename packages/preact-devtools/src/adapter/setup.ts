import { DevtoolsHook } from './hook';
import { Options, Fragment, Component } from 'preact';

export async function init(options: Options, getHook: () => DevtoolsHook) {
  const hook = getHook();
  if (hook.attachPreact) {
    return hook.attachPreact('10.10.6', options, {
      Fragment: Fragment as any,
      Component: Component as any,
    });
  } else {
    // eslint-disable-next-line no-console
    console.error(
      'Devtools hook is missing attachPreact() method. '
        + 'This happens when the running \'preact-devtools\' extension is too old. Please update it.',
    );
  }
}
