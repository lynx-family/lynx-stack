import { h, Fragment } from 'preact';
import s from './ElementProps.module.css';
import { Arrow } from '../../elements/TreeView';
import { PropDataType, PropData } from './parseProps';
import { DataInput } from '../../DataInput';
import { genPreview } from '../../DataInput/parseValue';
import { isCollapsed } from '../../../store/props';
import { useState, useCallback, useLayoutEffect, useMemo } from 'preact/hooks';

export type ChangeFn = (value: any, path: string, node: null | any) => void;

export interface Props {
  onChange?: ChangeFn;
  onCollapse?: (path: string) => void;
  uncollapsed: string[];
  items: PropData[];
}

export function ElementProps(props: Props) {
  const { onChange, uncollapsed, items, onCollapse } = props;

  return (
    <div class={s.root}>
      <form class={s.form} onSubmit={e => e.preventDefault()}>
        {items.map(item => {
          const id = item.id;
          return (
            <SingleItem
              id={id}
              key={id}
              type={item.type}
              name={item.name}
              collapseable={item.children.length > 0}
              collapsed={isCollapsed(uncollapsed, id)}
              onCollapse={() => onCollapse && onCollapse(id)}
              editable={item.editable}
              value={item.value}
              onChange={v => onChange && onChange(v, id, item)}
              depth={item.depth}
              index={item.index}
            />
          );
        })}
      </form>
    </div>
  );
}

export interface SingleProps {
  id: string;
  key?: string;
  editable?: boolean;
  type: PropDataType;
  collapseable?: boolean;
  collapsed?: boolean;
  name: string;
  value: any;
  onChange?: (value: any) => void;
  onCollapse?: (path: string) => void;
  depth: number;
  index?: number;
}

export function SingleItem(props: SingleProps) {
  const {
    id,
    onChange,
    editable = false,
    name,
    type,
    collapseable = false,
    collapsed = false,
    depth,
    onCollapse,
    value: initial,
  } = props;
  const [value, setValue] = useState(initial);

  useLayoutEffect(() => {
    setValue(genPreview(initial));
  }, [initial]);

  const onCommit = useCallback(
    (v: any) => {
      if (onChange) onChange(v);
    },
    [onChange],
  );

  const onChangeValue = useCallback((v: any) => {
    setValue(v);
  }, []);

  const onReset = useCallback(() => {
    setValue(initial);
  }, [initial]);

  const onClick = useCallback(() => {
    onCollapse && onCollapse(id);
  }, [onCollapse, id]);

  const preview = useMemo(() => genPreview(initial), [initial]);

  return (
    <div
      key={id}
      class={s.row}
      data-testid='props-row'
      data-depth={depth}
      style={`padding-left: calc(var(--indent-depth) * ${depth - 1})`}
    >
      {collapseable && (
        <button
          class={s.toggle}
          type='button'
          data-collapsed={collapsed}
          onClick={onClick}
        >
          <Arrow />
          {props.index !== undefined && (
            <span class='hook-number'>{props.index + 1}</span>
          )}
          <span
            class={`${s.name} ${s.nameEditable}`}
            data-testid='prop-name'
            data-type={initial !== '__preact_empty__' ? type : 'empty'}
          >
            {name}
          </span>
          {initial !== '__preact_empty__' && (
            <span class={s.property} data-testid='prop-value'>
              <span class={s.mask}>{preview}</span>
            </span>
          )}
        </button>
      )}
      {!collapseable && (
        <Fragment>
          {props.index !== undefined && (
            <span class={s.noCollapse}>
              <span class='hook-number'>{props.index + 1}</span>
            </span>
          )}
          <span
            class={`${s.name} ${
              props.index === undefined ? s.noCollapse : ''
            } ${s.nameStatic} ${editable ? s.nameEditable : ''}`}
            data-testid='prop-name'
            data-type={value !== '__preact_empty__' ? type : 'empty'}
          >
            {name}
          </span>
          <div class={s.property} data-testid='prop-value'>
            {value !== '__preact_empty__' && (
              <Fragment>
                {editable
                  ? (
                    <DataInput
                      value={value}
                      onReset={onReset}
                      onCommit={onCommit}
                      showReset={value !== preview}
                      onChange={onChangeValue}
                      name={`${id}`}
                    />
                  )
                  : <div class={s.mask}>{preview}</div>}
              </Fragment>
            )}
          </div>
        </Fragment>
      )}
    </div>
  );
}
