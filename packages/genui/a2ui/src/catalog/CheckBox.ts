import { CheckBox } from './CheckBox/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('CheckBox', CheckBox as unknown as ComponentRenderer);

export { CheckBox };
