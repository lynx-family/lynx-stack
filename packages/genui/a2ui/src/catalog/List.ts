import { List } from './List/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('List', List as unknown as ComponentRenderer);

export { List };
