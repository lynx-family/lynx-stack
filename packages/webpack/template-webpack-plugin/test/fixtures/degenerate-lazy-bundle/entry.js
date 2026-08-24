import { shared } from './shared.js';

export const eager = shared;
export const alsoStatic = import('./shared.js');
export const properlySplit = import('./split.js');
