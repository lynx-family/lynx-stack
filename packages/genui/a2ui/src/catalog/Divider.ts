import { Divider } from './Divider/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('Divider', Divider as unknown as ComponentRenderer);

export { Divider };
