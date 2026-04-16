import { RadioGroup } from './RadioGroup/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('RadioGroup', RadioGroup as unknown as ComponentRenderer);

export { RadioGroup };