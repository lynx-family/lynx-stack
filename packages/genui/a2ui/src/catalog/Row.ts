import { Row } from './Row/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('Row', Row as unknown as ComponentRenderer);

export { Row };
