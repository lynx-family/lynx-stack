import { h, Fragment } from 'preact';
import { useStore } from '../../store/react-bindings';
import s from './StatsPanel.module.css';
import { SingleLayout } from '../SidebarLayout';
import { Actions } from '../Actions';
import { IconBtn } from '../IconBtn';
import { useCallback } from 'preact/hooks';
import {
  OperationInfo,
  ParsedStats,
  StatsChildren,
} from '../../../adapter/shared/stats';
import { Icon } from '../icons';

export function StatsRecordBtn() {
  const store = useStore();
  const isRecording = store.stats.isRecording.value;

  const onClick = useCallback(() => {
    const { isRecording } = store.stats;
    const v = !isRecording.value;
    isRecording.value = v;

    if (v) {
      store.emit('start-stats-recording', null);
    } else {
      store.emit('stop-stats-recording', null);
    }
  }, [store]);

  return (
    <IconBtn
      title={!isRecording ? 'Start Recording' : 'Stop Recording'}
      color={isRecording
        ? 'var(--color-record-active)'
        : 'var(--color-selected-bg)'}
      onClick={onClick}
      testId='record-btn'
    >
      <Icon icon='record-icon' />
    </IconBtn>
  );
}

export function StatsPanel() {
  const store = useStore();
  const stats = store.stats.data.value;
  const isRecording = store.stats.isRecording.value;
  const onReloadAndRecordStats = useCallback(() => {
    store.stats.isRecording.value = true;
    store.emit('reload-and-record-stats', null);
  }, []);
  const onReset = useCallback(() => {
    store.stats.data.value = null;
    store.stats.isRecording.value = false;
    store.emit('stop-profiling', null);
  }, [store]);

  return (
    <SingleLayout>
      <div class={s.actions}>
        <Actions>
          <div class={s.btnWrapper}>
            <StatsRecordBtn />
          </div>
          <div class={s.btnWrapper}>
            <IconBtn
              title='Reload and record statistic'
              disabled={isRecording}
              testId='reload-and-record-stats-btn'
              onClick={onReloadAndRecordStats}
            >
              <Icon icon='refresh' />
            </IconBtn>
          </div>
          <div class={s.btnWrapper}>
            <IconBtn
              title='Clear statistic data'
              disabled={stats === null || isRecording}
              onClick={onReset}
            >
              <Icon icon='not-interested' />
            </IconBtn>
          </div>
        </Actions>
      </div>
      <div class={s.content}>
        {stats !== null
          ? <StatsData stats={stats} />
          : isRecording
          ? (
            <div class='profiler-info' data-testid='stats-info-recording'>
              <p class='profiler-info-title'>
                Statistic recording in progress...
              </p>
              <p class='profiler-info-descr'>
                Click the record button{' '}
                <span class='profiler-info-btn'>
                  <StatsRecordBtn />
                </span>{' '}
                to stop recording.
              </p>
            </div>
          )
          : (
            <div class='profiler-info' data-testid='stats-info'>
              <p class='profiler-info-title'>No statistic data collected</p>
              <p class='profiler-info-descr'>
                Click the record button{' '}
                <span class='profiler-info-btn'>
                  <StatsRecordBtn />
                </span>{' '}
                to start recording.
              </p>
            </div>
          )}
      </div>
    </SingleLayout>
  );
}

export function ChildHeadings() {
  return (
    <tr>
      <th>Type</th>
      <th>Total</th>
      <th>0 Ch.</th>
      <th>1 Ch.</th>
      <th>2 Ch.</th>
      <th>3 Ch.</th>
      <th>n Ch.</th>
    </tr>
  );
}

function getTotal(arr: number[]): number {
  return arr.reduce((acc, n) => acc + n, 0);
}

function getOpTotal(info: OperationInfo): number {
  return info.components + info.elements + info.text;
}

export function ChildRow(props: {
  label: string;
  total: number;
  count?: StatsChildren;
  testId?: string;
}) {
  const {
    label,
    total,
    count,
    testId = label.toLowerCase().replace(/\s/g, '-'),
  } = props;
  return (
    <tr>
      <td>{label}</td>
      <td class={s.alignRight} data-testid={testId + '-total'}>
        {total}
      </td>
      <td class={s.alignRight} data-testid={testId + '-0'}>
        {count ? count[0] : '-'}
      </td>
      <td class={s.alignRight} data-testid={testId + '-1'}>
        {count ? count[1] : '-'}
      </td>
      <td class={s.alignRight} data-testid={testId + '-2'}>
        {count ? count[2] : '-'}
      </td>
      <td class={s.alignRight} data-testid={testId + '-3'}>
        {count ? count[3] : '-'}
      </td>
      <td class={s.alignRight} data-testid={testId + '-n'}>
        {count ? count[4] : '-'}
      </td>
    </tr>
  );
}

function OperationRow({ name, info }: { name: string; info: OperationInfo }) {
  return (
    <tr>
      <td>{name}</td>
      <td class={s.alignRight} data-testid={name + '-total'}>
        {getOpTotal(info)}
      </td>
      <td class={s.alignRight} data-testid={name + '-components'}>
        {info.components}
      </td>
      <td class={s.alignRight} data-testid={name + '-elements'}>
        {info.elements}
      </td>
      <td class={s.alignRight} data-testid={name + '-text'}>
        {info.text}
      </td>
    </tr>
  );
}

export function StatsData({ stats }: { stats: ParsedStats }) {
  return (
    <Fragment>
      <div class={s.intro}>
        <p>
          Help us make Preact even faster by sharing these statistics over at
          {' '}
          <a
            href='https://github.com/preactjs/preact/issues/2618'
            rel='noopener noreferrer'
            target='_blank'
            data-testid='stats-github-link'
          >
            this GitHub thread
          </a>
          .
        </p>
      </div>
      <div class={s.cards}>
        <div class={s.card}>
          <h2 class={s.heading}>Operations</h2>

          <table class={s.table} data-testid='operation-type'>
            <thead>
              <tr>
                <th>Type</th>
                <th>Total</th>
                <th>Components</th>
                <th>Elements</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody>
              <OperationRow name='mount' info={stats.mounts} />
              <OperationRow name='update' info={stats.updates} />
              <OperationRow name='unmount' info={stats.unmounts} />
            </tbody>
          </table>
        </div>

        <div class={s.card}>
          <h2 class={s.heading}>Reconciler</h2>

          <table class={s.table} data-testid='diff-type'>
            <thead>
              <ChildHeadings />
            </thead>
            <tbody>
              <ChildRow
                label='keyed'
                total={getTotal(stats.keyed)}
                count={stats.keyed}
              />
              <ChildRow
                label='unkeyed'
                total={getTotal(stats.unkeyed)}
                count={stats.unkeyed}
              />
              <ChildRow
                label='mixed'
                total={getTotal(stats.mixed)}
                count={stats.mixed}
              />
            </tbody>
          </table>
        </div>

        <div class={s.card}>
          <h2 class={s.heading}>Render Frequency</h2>

          <table class={s.table} data-testid='vnode-stats'>
            <thead>
              <ChildHeadings />
            </thead>
            <tbody>
              <ChildRow
                label='Root'
                testId='root'
                total={getTotal(stats.roots)}
                count={stats.roots}
              />
              <ChildRow
                label='Class Component'
                testId='class-component'
                total={getTotal(stats.classComponents)}
                count={stats.classComponents}
              />
              <ChildRow
                label='Function Component*'
                testId='function-component'
                total={getTotal(stats.functionComponents)}
                count={stats.functionComponents}
              />
              <ChildRow
                label='Fragment'
                testId='fragment'
                total={getTotal(stats.fragments)}
                count={stats.fragments}
              />
              <ChildRow
                label='forwardRef'
                testId='forwardref'
                total={getTotal(stats.forwardRef)}
                count={stats.forwardRef}
              />
              <ChildRow
                label='Memo'
                testId='memo'
                total={getTotal(stats.memo)}
                count={stats.memo}
              />
              <ChildRow
                label='Suspense'
                testId='suspense'
                total={getTotal(stats.suspense)}
                count={stats.suspense}
              />
              <ChildRow
                label='Element'
                testId='element'
                total={getTotal(stats.elements)}
                count={stats.elements}
              />

              <ChildRow label='Text**' testId='text' total={stats.text} />
            </tbody>
          </table>
          <small>* includes any component that is built via a function.</small>
          <br />
          <small>** Text nodes can&apos;t have children.</small>
        </div>

        <div class={s.card}>
          <h2 class={s.heading}>Single Child Type</h2>

          <table class={s.table} data-testid='sing-child-type'>
            <thead>
              <tr>
                <th>Type</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Root</td>
                <td data-testid='single-root'>{stats.singleChildType.roots}</td>
              </tr>
              <tr>
                <td>Class Component</td>
                <td data-testid='single-class-component'>
                  {stats.singleChildType.classComponents}
                </td>
              </tr>
              <tr>
                <td>Function Component*</td>
                <td data-testid='single-function-component'>
                  {stats.singleChildType.functionComponents}
                </td>
              </tr>
              <tr>
                <td>Fragment</td>
                <td data-testid='single-fragment'>
                  {stats.singleChildType.fragments}
                </td>
              </tr>
              <tr>
                <td>forwardRef</td>
                <td data-testid='single-forwardref'>
                  {stats.singleChildType.forwardRef}
                </td>
              </tr>
              <tr>
                <td>Memo</td>
                <td data-testid='single-memo'>{stats.singleChildType.memo}</td>
              </tr>
              <tr>
                <td>Suspense</td>
                <td data-testid='single-suspense'>
                  {stats.singleChildType.suspense}
                </td>
              </tr>
              <tr>
                <td>Element</td>
                <td data-testid='single-element'>
                  {stats.singleChildType.elements}
                </td>
              </tr>
              <tr>
                <td>Text</td>
                <td data-testid='single-text'>{stats.singleChildType.text}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Fragment>
  );
}
