import { ID } from '../../../store/types';

export interface NodeTransform {
  id: ID;
  x: number;
  row: number;
  width: number;
  weight: number;
  maximized: boolean;
  visible: boolean;
  commitParent: boolean;
}
