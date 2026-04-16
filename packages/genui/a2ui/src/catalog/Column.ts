import { Column } from './Column/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('Column', Column as unknown as ComponentRenderer);

export { Column };
