import { h, Fragment } from 'preact';
import { SidebarPanel, Empty } from '../../sidebar/SidebarPanel';
import { useStore } from '../../../store/react-bindings';
import { RenderReason } from '../../../../adapter/shared/renderReasons';
import { Message, MessageBtn } from '../../Message/Message';
import { startProfiling } from '../data/commits';

function getReasonName(reason: RenderReason) {
  switch (reason) {
    case RenderReason.HOOKS_CHANGED:
      return 'Hooks changed';
    case RenderReason.MOUNT:
      return 'Component mounted';
    case RenderReason.PARENT_UPDATE:
      return 'Parent updated';
    case RenderReason.PROPS_CHANGED:
      return 'Props changed';
    case RenderReason.STATE_CHANGED:
      return 'State changed';
    case RenderReason.FORCE_UPDATE:
      return 'Force update';
    default:
      return 'Unknown reason';
  }
}

export function RenderReasons() {
  const store = useStore();
  const isRecording = store.profiler.isRecording.value;
  const commits = store.profiler.commits.value;
  const reason = store.profiler.activeReason.value;
  const commit = store.profiler.activeCommit.value;
  const selected = store.profiler.selectedNode.value;
  const isSupported = store.profiler.supportsRenderReasons.value;
  const captureReason = store.profiler.captureRenderReasons.value;

  if (commits.length === 0 || isRecording) {
    return null;
  }

  const hasReasons = reason !== null && reason.items && reason.items.length > 0;

  const rendered = !captureReason && commit && selected
    && commit.rendered.has(selected.id);

  return (
    <SidebarPanel title='Render reasons'>
      <div data-testid='render-reasons'>
        {reason !== null
          ? (
            <dl class='render-reason'>
              <dt class='render-reason-name'>
                {getReasonName(reason.type)}
                {hasReasons ? ':' : ''}
              </dt>
              <dd class='render-reason-value'>
                {hasReasons
                  && (reason.type === RenderReason.HOOKS_CHANGED
                    ? (
                      <>
                        {reason!.items!.map(item => (
                          <span class='hook-number va-middle' key={item}>
                            {+item + 1}
                          </span>
                        ))}
                      </>
                    )
                    : (
                      reason!.items!.join(', ')
                    ))}
              </dd>
            </dl>
          )
          : <Empty>{rendered ? '-' : 'Did not render'}</Empty>}
      </div>
      <div class='render-reason-message'>
        {isSupported
          ? (
            <div class='sidebar-nav-panel-content'>
              <Message type={captureReason ? 'info' : 'warning'}>
                {captureReason
                  ? 'Timings may be less accurate. '
                  : 'Capturing disabled. '}
                <MessageBtn
                  onClick={() => {
                    const value = !captureReason;
                    store.profiler.setRenderReasonCapture(value);
                    startProfiling(store.profiler);
                    store.emit('start-profiling', {
                      captureRenderReasons: value,
                    });
                  }}
                  testId='toggle-render-reason'
                >
                  {captureReason ? 'Disable' : 'Enable'}
                </MessageBtn>
              </Message>
            </div>
          )
          : (
            <div class='sidebar-nav-panel-content'>
              <Message type='warning'>
                Upgrade to Preact &gt;=10.4.1 to fully enable this feature.
              </Message>
            </div>
          )}
      </div>
    </SidebarPanel>
  );
}
