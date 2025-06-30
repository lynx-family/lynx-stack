import { h } from 'preact';
import { useRef, useCallback } from 'preact/hooks';
import { NodeTransform } from './shared';
import { ID } from '../../../store/types';

export interface Props {
  selected: boolean;
  children: any;
  parentId: number;
  name: string;
  onClick: (id: ID) => void;
  node: NodeTransform;
  onMouseEnter: (id: ID) => void;
  onMouseLeave: () => void;
}

const ROW_HEIGHT = 21; // Account 1px for border
const MIN_TEXT_WIDTH = 32; // Don't show text if smaller than this value

export function FlameNode(props: Props) {
  const { onClick, selected, node, onMouseEnter, onMouseLeave, name } = props;

  const transform = useRef('');
  const widthCss = useRef('');

  const onRawClick = useCallback(() => onClick(node.id), [node.id]);
  const onRawMouseEnter = useCallback(() => onMouseEnter(node.id), [node.id]);

  const { visible, width, x } = node;

  if (width < 0.5) {
    return null;
  }

  if (visible) {
    widthCss.current = `width: ${width}px;`;
    transform.current = `transform: translate3d(${x}px, 0, 0);`;
  }

  return (
    <div
      class='flamegraph-node'
      onClick={onRawClick}
      onMouseEnter={onRawMouseEnter}
      onMouseLeave={onMouseLeave}
      data-id={node.id}
      data-testid='flame-node'
      data-parent-id={props.parentId}
      data-visible={visible}
      data-weight={node.weight}
      data-commit-parent={node.commitParent}
      data-maximized={node.maximized}
      data-selected={selected}
      data-overflow={width < MIN_TEXT_WIDTH}
      data-name={name}
      style={`height: ${ROW_HEIGHT}px; ${transform.current} ${widthCss.current}`}
    >
      <span class='flamegraph-text' style={widthCss.current}>
        {props.children}
      </span>
    </div>
  );
}
