import { sharedValue } from './nested/Shared.jsx';
export { worklets } from './init-runtime.js';

export const components = __MAIN_THREAD__ ? null : [sharedValue];
