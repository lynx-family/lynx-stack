import { h } from 'preact';
import s from './Highlighter.module.css';
import { Measurements } from '../../adapter/dom';

export function css2Border(
  top: number,
  right: number,
  bottom: number,
  left: number,
) {
  return `
		border-top-width: ${top}px;
		border-right-width: ${right}px;
		border-bottom-width: ${bottom}px;
		border-left-width: ${left}px;
	`;
}

export const style = s;

export interface Props extends Measurements {
  label: string;
}

export function Highlighter(props: Props) {
  const { width, height, boxSizing, top, left, bounds } = props;

  const isOutOfBounds = bounds.bottom || bounds.left || bounds.right
    || bounds.top;

  return (
    <div
      class={s.root}
      data-testid='highlight'
      style={`top: ${top}px; left: ${left}px;`}
    >
      <div
        class={s.margin}
        style={`width: ${width}px; height: ${height}px; ${
          css2Border(
            props.marginTop,
            props.marginRight,
            props.marginBottom,
            props.marginLeft,
          )
        }`}
      >
        <div
          class={s.border}
          style={css2Border(
            props.borderTop,
            props.borderRight,
            props.borderBottom,
            props.borderLeft,
          )}
        >
          <div
            class={s.content}
            style={`${
              css2Border(
                props.paddingTop,
                props.paddingRight,
                props.paddingBottom,
                props.paddingLeft,
              )
            } ${
              boxSizing === 'content-box'
                ? `height: calc(100% - ${
                  props.paddingTop + props.paddingBottom
                }px); width: calc(100% - ${
                  props.paddingLeft + props.paddingRight
                }px);`
                : ''
            }`}
          />
        </div>
      </div>
      <span
        class={`${s.footer} ${isOutOfBounds ? s.fixed : ''} ${
          bounds.left && !bounds.right ? s.fixedLeft : ''
        } ${bounds.right ? s.fixedRight : ''} ${
          bounds.top && !bounds.bottom ? s.fixedTop : ''
        }  ${bounds.bottom ? s.fixedBottom : ''}`}
      >
        <span class={s.label} data-testid='highlighter-label'>
          {props.label}
        </span>{' '}
        | <span class={s.value}>{width}px</span> ×{' '}
        <span class={s.value}>{height}px</span>
      </span>
    </div>
  );
}
