import { host } from './host-env.js';
if (!host.ready) throw new Error('Worklet init must follow host setup');
export const worklets = [];
export const registerWorklet = (_type, _id, fn) => worklets.push(fn);
