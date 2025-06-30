import { h, Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { AppCtx, EmitCtx, WindowCtx } from '../store/react-bindings';
import { Store, Panel } from '../store/types';
import { Elements } from './elements/Elements';
import { Profiler } from './profiler/components/Profiler';
import { SmallTab, SmallTabGroup } from './profiler/components/Tabs/Tabs';
import './devtools.css';
import s from './Devtools.module.css';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Settings } from './settings/Settings';
import { StatsPanel } from './stats/StatsPanel';

const { addPluginEventListener } = window as any;

export function DevTools(props: { store: Store; ctx: PreactDevtoolsLDTCtx }) {
  const panel = props.store.activePanel.value;

  useEffect(() => {
    // notify react-lynx that we need an init if there is no root
    if (props.store.roots.value.length === 0) {
      props.ctx.devtoolsProps.postMessage('Remote.Customized.CDP', {
        method: 'Page.reload',
        params: {},
      });
    }
  });

  useEffect(() => {
    const onUINodeIdSelected = (UINodeId?: number) => {
      if (UINodeId == null) return;
      if (UINodeId === globalThis.preactDevtoolsLDTCtx.highlightUniqueId) {
        if (__DEBUG__) {
          console.log(
            `skip because unique id of ${UINodeId} has been highlighted`,
          );
        }
        return;
      }

      props.store.emit('element-picked', {
        uniqueId: UINodeId,
      });
    };

    if (props.ctx.devtoolsProps.addOnScreenCastPanelUINodeIdSelectedListener) {
      props.ctx.devtoolsProps.addOnScreenCastPanelUINodeIdSelectedListener?.(
        (UINodeId) => {
          onUINodeIdSelected(UINodeId);
        },
      );
    } else {
      addPluginEventListener?.('uitree-drawer')(
        'Extensions.uitree-drawer',
        (msg: any) => {
          const { UINodeId } = msg || {};
          onUINodeIdSelected(UINodeId);
        },
      );
    }
  }, []);

  const showElements = panel === Panel.ELEMENTS;
  const showProfiler = panel === Panel.PROFILER;
  const showSettings = panel === Panel.SETTINGS;
  const showStats = panel === Panel.STATISTICS;

  return (
    <WindowCtx.Provider value={props.ctx}>
      <EmitCtx.Provider value={props.store.emit}>
        <AppCtx.Provider value={props.store}>
          <Fragment>
            <div class={`${s.theme} ${s.root}`}>
              <ThemeSwitcher />
              <SmallTabGroup class={s.switcher}>
                <div class={s.switcherInner}>
                  <SmallTab
                    onClick={() => (props.store.activePanel.value =
                      Panel.ELEMENTS)}
                    checked={showElements}
                    name='root-panel'
                    value={Panel.ELEMENTS}
                  >
                    Elements
                  </SmallTab>
                  <SmallTab
                    onClick={() => (props.store.activePanel.value =
                      Panel.PROFILER)}
                    checked={showProfiler}
                    name='root-panel'
                    value={Panel.PROFILER}
                  >
                    Profiler
                  </SmallTab>
                  <SmallTab
                    onClick={() => (props.store.activePanel.value =
                      Panel.STATISTICS)}
                    checked={showStats}
                    name='root-panel'
                    value={Panel.STATISTICS}
                  >
                    Statistics
                  </SmallTab>
                  <SmallTab
                    onClick={() => (props.store.activePanel.value =
                      Panel.SETTINGS)}
                    checked={showSettings}
                    name='root-panel'
                    value={Panel.SETTINGS}
                  >
                    Settings
                  </SmallTab>
                </div>
                <a
                  class={s.bugLink}
                  href='https://github.com/lynx-family/lynx-stack/issues'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Report bug
                </a>
              </SmallTabGroup>
              {showElements && <Elements />}
              {showProfiler && <Profiler />}
              {showStats && <StatsPanel />}
              {showSettings && <Settings />}
            </div>
          </Fragment>
        </AppCtx.Provider>
      </EmitCtx.Provider>
    </WindowCtx.Provider>
  );
}
