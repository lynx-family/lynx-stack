import { FunctionComponent, h } from 'preact';
import { getPathToSource } from './utils/getPathToSource';
import { Source } from '../../../adapter/adapter/adapter';
import { getUrl } from './utils/getUrl';

export const ClickToComponent: FunctionComponent<{
  source?: Source;
}> = ({ source }) => {
  if (!source) return null;

  const path = getPathToSource(source);
  // TODO: should we support vscode-insiders and cursor as click-to-component does? https://github.com/ericclemmons/click-to-component/pull/88/files
  const editor = 'vscode';
  const url = getUrl({
    editor,
    pathToSource: path,
  });

  return (
    <>
      <div
        style={{
          fontSize: '12px',
          marginTop: '1rem',
        }}
      >
        source location
      </div>
      <div
        style={{
          marginTop: '0.25rem',
          marginLeft: '1rem',
        }}
      >
        <a
          style={{
            textDecoration: 'none',
            marginRight: '0.25rem',
            color: 'var(--color-element-text)',
            cursor: 'pointer',
            wordWrap: 'break-word',
            fontSize: '12px',
          }}
          onClick={e => {
            e.preventDefault();
            window.location.assign(url);
          }}
        >
          {path}
        </a>
      </div>
    </>
  );
};
