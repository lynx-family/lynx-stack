import * as v0_9 from '@a2ui/web_core/v0_9';
import type { ComponentProps } from "../../core/ComponentRegistry";

import './style.css';

export interface DividerProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function Divider(props: any): any {
  const { id, axis = 'horizontal' } = props;
  return <view key={id} className={`divider divider-${axis}`} />;
}
