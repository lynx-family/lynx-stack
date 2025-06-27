import { h, Fragment } from 'preact';

export function ComponentName(props: { children: any }) {
  return (
    <span class='component-name-title' data-testid='inspect-component-name'>
      {props.children
        ? (
          <Fragment>
            <span class='component-name-ch'>&lt;</span>
            {props.children}
            <span class='component-name-ch'>&gt;</span>
          </Fragment>
        )
        : (
          '-'
        )}
    </span>
  );
}
