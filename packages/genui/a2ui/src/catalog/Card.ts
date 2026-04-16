import { Card } from './Card/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('Card', Card as unknown as ComponentRenderer);

export { Card };
