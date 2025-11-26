import type { MainThread } from '@lynx-js/types';
import { ElementCompt } from './element.js';
declare global {
    var ElementCompt: new (element: MainThread.Element) => ElementCompt;
}
