// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  createContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Drawer } from 'vaul';

import { CopyToast, useCopyToast } from './CopyToast.js';
import { PreviewSimulationBar } from './PreviewSimulationBar.js';
import { QrCode } from './QrCode.js';
import { componentsByMessage } from '../demos.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

export type PreviewMode = 'phone' | 'full';

export interface PreviewPanelPreviewModeContextValue {
  mode: PreviewMode;
  setMode: (mode: PreviewMode) => void;
}

export const PreviewPanelPreviewModeContext = createContext<
  PreviewPanelPreviewModeContextValue | null
>(null);

export interface PreviewPanelRenderContextValue {
  renderUrl: string;
}

export const PreviewPanelRenderContext = createContext<
  PreviewPanelRenderContextValue | null
>(null);

export interface PreviewQrItem {
  title: ReactNode;
  description: ReactNode;
  url?: string;
  urlTitle?: string;
  copyButtonTitle?: string;
  variant?: 'default' | 'alt';
  placeholder?: ReactNode;
  errorDescription?: ReactNode;
  showQrCode?: boolean;
}

interface A2UIPreviewSource {
  kind: 'a2ui';
  protocol: Protocol;
  demoUrl: string;
  theme: 'light' | 'dark';
  messages: unknown;
  actionMocks?: Record<string, unknown>;
  demoId?: string;
  /**
   * When true, build the render URL in playback mode so the Lynx app waits
   * for `A2UI_PLAYBACK_PROGRESS` events instead of streaming on its own.
   */
  playbackMode?: boolean;
}

interface OpenUIPreviewSource {
  kind: 'openui';
  rawText: string;
}

interface PlaceholderPreviewSource {
  kind: 'placeholder';
  item: PreviewQrItem;
}

export type PreviewPanelSource =
  | A2UIPreviewSource
  | OpenUIPreviewSource
  | PlaceholderPreviewSource;

interface PreviewPanelProps {
  className?: string;
  style?: CSSProperties;
  title: ReactNode;
  headerAfterTitle?: ReactNode;
  previewSource?: PreviewPanelSource;
  showPreviewModeSwitch?: boolean;
  showSimulationBar?: boolean;
  beforeBody?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
  afterBody?: ReactNode;
}

function PreviewModeSwitch(props: {
  mode: PreviewMode;
  onChange: (mode: PreviewMode) => void;
}) {
  const { mode, onChange } = props;
  return (
    <div className='previewModeSwitch'>
      <button
        type='button'
        className={mode === 'phone'
          ? 'previewModeBtn active'
          : 'previewModeBtn'}
        onClick={() => onChange('phone')}
        title='Phone frame'
      >
        Phone
      </button>
      <button
        type='button'
        className={mode === 'full' ? 'previewModeBtn active' : 'previewModeBtn'}
        onClick={() => onChange('full')}
        title='Full panel'
      >
        Full
      </button>
    </div>
  );
}

function getDeployedLynxBundleUrl(): string {
  try {
    return new URL('a2ui.lynx.js', window.location.href).toString();
  } catch {
    return '';
  }
}

function useRspeedyDevUrl(): string {
  const [url, setUrl] = useState<string>(() => getDeployedLynxBundleUrl());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await window.fetch('/__rspeedy_url', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { url?: string };
        if (!cancelled && typeof data.url === 'string' && data.url) {
          setUrl(data.url);
        }
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return url;
}

function formatUrlForDisplay(url: string): string {
  if (url.length <= 80) return url;
  const head = url.slice(0, 44);
  const tail = url.slice(-24);
  return `${head}…${tail}`;
}

function buildOpenUIRenderUrl(
  rawText: string,
  baseUrl: string,
  speed: number,
): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', 'openui');
  url.searchParams.set('demoUrl', './openui.web.js');
  url.searchParams.set('rawText', rawText);
  if (speed !== 1) {
    url.searchParams.set('speed', String(speed));
  }
  return url.toString();
}

export function PreviewPanel(props: PreviewPanelProps) {
  const {
    afterBody,
    beforeBody,
    bodyClassName,
    children,
    className,
    headerAfterTitle,
    previewSource,
    showPreviewModeSwitch = false,
    showSimulationBar = true,
    style,
    title,
  } = props;
  const [mode, setMode] = useState<PreviewMode>('phone');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [simulationInfoOpen, setSimulationInfoOpen] = useState(false);
  const [renderUrl, setRenderUrl] = useState('');
  const [renderShareUrl, setRenderShareUrl] = useState('');
  const [lynxDevUrl, setLynxDevUrl] = useState('');
  const [webCopied, setWebCopied] = useState(false);
  const [webCopyFailed, setWebCopyFailed] = useState(false);
  const [webQrError, setWebQrError] = useState('');
  const [nativeCopied, setNativeCopied] = useState(false);
  const [nativeCopyFailed, setNativeCopyFailed] = useState(false);
  const [nativeQrError, setNativeQrError] = useState('');
  const { showCopyToast, toast: copyToast } = useCopyToast();
  const [liveComponents, setLiveComponents] = useState<string[]>([]);
  const liveTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const buildSeqRef = useRef(0);
  const speedInputId = useId();

  const rspeedyDevUrl = useRspeedyDevUrl();
  const baseUrl = useMemo(() => window.location.href.replace(/#.*$/, ''), []);
  const shareBaseUrl = useMemo(() => {
    const u = new URL(baseUrl);
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
      && rspeedyDevUrl
    ) {
      try {
        u.hostname = new URL(rspeedyDevUrl).hostname;
      } catch {
        // ignore hostname rewrite failures and keep the original URL
      }
    }
    return u.toString();
  }, [baseUrl, rspeedyDevUrl]);

  const renderContext = useMemo<PreviewPanelRenderContextValue>(
    () => ({ renderUrl }),
    [renderUrl],
  );
  const bodyClass = bodyClassName
    ?? (mode === 'full' || isFullscreen
      ? 'previewPanelBody previewPanelBodyFull'
      : 'previewPanelBody');
  const panelStyle = isFullscreen
    ? {
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      width: '100vw',
      height: '100vh',
    }
    : style;

  useEffect(() => {
    setWebCopied(false);
    setWebCopyFailed(false);
    setWebQrError('');
  }, []);

  useEffect(() => {
    setNativeCopied(false);
    setNativeCopyFailed(false);
    setNativeQrError('');
  }, []);

  useEffect(() => {
    for (const timer of liveTimersRef.current) clearTimeout(timer);
    liveTimersRef.current = [];
    setLiveComponents([]);

    if (!previewSource || previewSource.kind !== 'a2ui') {
      return;
    }

    const perMsg = componentsByMessage(previewSource.messages);
    const delayMs = 800 / (speed || 1);
    let accumulated: string[] = [];
    perMsg.forEach((newNames, i) => {
      if (newNames.length === 0) return;
      const timer = setTimeout(() => {
        accumulated = [...accumulated, ...newNames];
        setLiveComponents([...accumulated]);
      }, delayMs * (i + 1));
      liveTimersRef.current.push(timer);
    });

    return () => {
      for (const timer of liveTimersRef.current) clearTimeout(timer);
      liveTimersRef.current = [];
    };
  }, [previewSource, speed]);

  useEffect(() => {
    const seq = ++buildSeqRef.current;

    if (!previewSource) {
      setRenderUrl('');
      setRenderShareUrl('');
      setLynxDevUrl('');
      return;
    }

    if (previewSource.kind === 'placeholder') {
      setRenderUrl('');
      setRenderShareUrl('');
      setLynxDevUrl('');
      return;
    }

    if (previewSource.kind === 'a2ui') {
      const url = buildRenderUrl(
        {
          protocol: previewSource.protocol,
          demoUrl: previewSource.demoUrl ?? DEFAULT_A2UI_DEMO_URL,
          messages: previewSource.messages,
          actionMocks: previewSource.actionMocks,
          theme: previewSource.theme,
          demoId: previewSource.demoId,
          speed,
          playbackMode: previewSource.playbackMode,
        },
        baseUrl,
      );
      // Shared URLs always render normally — playback is a local-only
      // visualization tool, not something a QR-scanner should land in.
      const shareUrl = buildRenderUrl(
        {
          protocol: previewSource.protocol,
          demoUrl: previewSource.demoUrl ?? DEFAULT_A2UI_DEMO_URL,
          messages: previewSource.messages,
          actionMocks: previewSource.actionMocks,
          theme: previewSource.theme,
          demoId: previewSource.demoId,
          speed,
        },
        shareBaseUrl,
      );
      setRenderUrl(url);
      setRenderShareUrl(shareUrl);

      if (!rspeedyDevUrl) {
        setLynxDevUrl('');
        return;
      }

      const uInline = new URL(rspeedyDevUrl);
      if (speed !== 1) {
        uInline.searchParams.set('speed', String(speed));
      }
      uInline.searchParams.set('theme', previewSource.theme);
      if (previewSource.demoId) {
        const demosBase = shareBaseUrl.endsWith('/')
          ? shareBaseUrl
          : `${shareBaseUrl}/`;
        uInline.searchParams.set(
          'messagesUrl',
          new URL(`demos/${previewSource.demoId}.json`, demosBase).toString(),
        );
      } else {
        uInline.searchParams.set(
          'messages',
          JSON.stringify(previewSource.messages),
        );
        if (previewSource.actionMocks) {
          uInline.searchParams.set(
            'actionMocks',
            JSON.stringify(previewSource.actionMocks),
          );
        }
      }
      setLynxDevUrl(uInline.toString());
      return;
    }

    const url = buildOpenUIRenderUrl(previewSource.rawText, baseUrl, speed);
    const shareUrl = buildOpenUIRenderUrl(
      previewSource.rawText,
      shareBaseUrl,
      speed,
    );
    setRenderUrl(url);
    setRenderShareUrl(shareUrl);

    if (!rspeedyDevUrl) {
      setLynxDevUrl('');
      return;
    }

    const uInline = new URL(rspeedyDevUrl);
    uInline.pathname = uInline.pathname.replace('a2ui.lynx', 'openui.lynx');
    uInline.searchParams.set('rawText', previewSource.rawText);
    if (speed !== 1) {
      uInline.searchParams.set('speed', String(speed));
    }
    setLynxDevUrl(uInline.toString());

    void (async () => {
      try {
        const rspeedyOrigin = new URL(rspeedyDevUrl).origin;
        const res = await window.fetch(`${rspeedyOrigin}/__openui_payload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText: previewSource.rawText }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { rawTextUrl?: string };

        if (seq !== buildSeqRef.current) return;

        if (typeof data.rawTextUrl === 'string') {
          const rawTextUrlAbs = `${rspeedyOrigin}${data.rawTextUrl}`;
          const u = new URL(rspeedyDevUrl);
          u.pathname = u.pathname.replace('a2ui.lynx', 'openui.lynx');
          u.searchParams.set('rawTextUrl', rawTextUrlAbs);
          u.searchParams.delete('rawText');
          if (speed !== 1) {
            u.searchParams.set('speed', String(speed));
          }
          setLynxDevUrl(u.toString());

          const r = new URL('render.html', baseUrl);
          r.searchParams.set('protocol', 'openui');
          r.searchParams.set('demoUrl', './openui.web.js');
          r.searchParams.set('rawTextUrl', rawTextUrlAbs);
          if (speed !== 1) {
            r.searchParams.set('speed', String(speed));
          }
          setRenderUrl(r.toString());

          const s = new URL('render.html', shareBaseUrl);
          s.searchParams.set('protocol', 'openui');
          s.searchParams.set('demoUrl', './openui.web.js');
          s.searchParams.set('rawTextUrl', rawTextUrlAbs);
          if (speed !== 1) {
            s.searchParams.set('speed', String(speed));
          }
          setRenderShareUrl(s.toString());
        }
      } catch {
        // Keep the inline URLs above if shortening is unavailable.
      }
    })();
  }, [baseUrl, previewSource, rspeedyDevUrl, shareBaseUrl, speed]);

  useEffect(() => {
    if (!previewSource || previewSource.kind === 'placeholder') {
      setIsFullscreen(false);
      return;
    }

    if (typeof window !== 'undefined' && window.innerWidth <= 980) {
      setIsFullscreen(true);
    }
  }, [previewSource]);

  const previewQrPlaceholder = useMemo(() => {
    return previewSource?.kind === 'placeholder' ? previewSource.item : null;
  }, [previewSource]);

  const previewQrCards = useMemo(() => {
    if (!previewSource || previewSource.kind === 'placeholder') {
      return [];
    }

    const showQrCode = previewSource.kind !== 'a2ui' || !!previewSource.demoId;

    const cards: Array<{ key: string; item: PreviewQrItem }> = [];
    if (renderShareUrl) {
      cards.push({
        key: 'webPreview',
        item: {
          title: 'Web Preview',
          description: 'Opens in any mobile browser via Lynx for Web.',
          url: renderShareUrl,
          urlTitle: formatUrlForDisplay(renderShareUrl),
          copyButtonTitle: 'Copy render URL',
          showQrCode,
        },
      });
    }
    if (lynxDevUrl) {
      cards.push({
        key: 'nativePreview',
        item: {
          title: 'Native Preview',
          description: 'Opens in LynxExplorer for native rendering.',
          url: lynxDevUrl,
          urlTitle: formatUrlForDisplay(lynxDevUrl),
          copyButtonTitle: 'Copy Lynx dev bundle URL',
          variant: 'alt',
          showQrCode,
        },
      });
    }

    return cards;
  }, [lynxDevUrl, previewSource, renderShareUrl]);

  const handleCopyUrl = (key: string, value: string) => {
    if (key === 'webPreview') {
      void copyToClipboard(value).then((ok) => {
        showCopyToast(ok);
        setWebCopyFailed(false);
        if (!ok) {
          setWebCopied(false);
          setWebCopyFailed(true);
          window.setTimeout(() => setWebCopyFailed(false), 1200);
          return;
        }
        setWebCopied(true);
        window.setTimeout(() => setWebCopied(false), 1200);
      });
      return;
    }

    void copyToClipboard(value).then((ok) => {
      showCopyToast(ok);
      setNativeCopyFailed(false);
      if (!ok) {
        setNativeCopied(false);
        setNativeCopyFailed(true);
        window.setTimeout(() => setNativeCopyFailed(false), 1200);
        return;
      }
      setNativeCopied(true);
      window.setTimeout(() => setNativeCopied(false), 1200);
    });
  };

  // Rendered both inline (when the panel is wide enough) and inside the
  // bottom sheet (when the panel is narrow). The function closes over all
  // local state so both instances stay in sync without prop plumbing.
  const renderExtras = () => (
    <>
      {previewSource?.kind === 'a2ui'
        ? (
          <div className='liveComponentStack' aria-live='polite'>
            <span className='liveComponentLabel'>Components</span>
            {liveComponents.length > 0
              ? (
                <div className='liveComponentTags'>
                  {liveComponents.map((name) => (
                    <span key={name} className='liveComponentTag'>
                      {name}
                    </span>
                  ))}
                </div>
              )
              : (
                <span className='liveComponentEmpty'>
                  Waiting for streamed components
                </span>
              )}
          </div>
        )
        : null}
      {previewQrPlaceholder
        ? (
          <div className='previewQrSection'>
            <div className='previewQrContent'>
              <div className='previewQrInfo'>
                <div className='previewQrTitle'>
                  {previewQrPlaceholder.title}
                </div>
                <div className='previewQrDesc'>
                  {previewQrPlaceholder.description}
                </div>
                <div className='previewQrPlaceholder'>
                  <span className='previewQrPlaceholderText'>
                    {previewQrPlaceholder.placeholder}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
        : (previewQrCards.length > 0
          ? (
            <div className='previewQrSection'>
              {previewQrCards.map(({ key, item }) => {
                const copied = key === 'webPreview' ? webCopied : nativeCopied;
                const copyFailed = key === 'webPreview'
                  ? webCopyFailed
                  : nativeCopyFailed;
                const error = key === 'webPreview' ? webQrError : nativeQrError;
                const setError = key === 'webPreview'
                  ? setWebQrError
                  : setNativeQrError;

                return (
                  <div
                    key={key}
                    className={item.variant === 'alt'
                      ? 'previewQrContent previewQrContentAlt'
                      : 'previewQrContent'}
                  >
                    <div className='previewQrInfo'>
                      <div className='previewQrTitle'>{item.title}</div>
                      <div className='previewQrDesc'>
                        {error && item.errorDescription
                          ? item.errorDescription
                          : item.description}
                      </div>
                      <div className='previewQrUrlRow'>
                        <div
                          className='previewQrUrlText'
                          title={item.urlTitle ?? item.url}
                        >
                          {item.urlTitle ?? item.url}
                        </div>
                        <button
                          type='button'
                          className='previewQrCopyBtn'
                          aria-label={item.copyButtonTitle ?? 'Copy URL'}
                          title={copied
                            ? 'Copied'
                            : (copyFailed
                              ? 'Copy failed'
                              : (item.copyButtonTitle ?? 'Copy URL'))}
                          onClick={() => {
                            if (item.url) {
                              handleCopyUrl(key, item.url);
                            }
                          }}
                        >
                          {copied
                            ? 'Copied'
                            : (copyFailed ? 'Failed' : 'Copy')}
                        </button>
                      </div>
                    </div>
                    {item.url && item.showQrCode !== false
                      ? (
                        <QrCode
                          value={item.url}
                          size={128}
                          onErrorChange={setError}
                        />
                      )
                      : null}
                    {item.url && item.showQrCode === false
                      ? (
                        <div className='previewQrUnavailable'>
                          <span className='previewQrUnavailableLabel'>
                            QR unavailable
                          </span>
                          <span className='previewQrUnavailableSubtext'>
                            URL too long to encode
                          </span>
                        </div>
                      )
                      : null}
                    {!item.url && item.placeholder
                      ? (
                        <div className='previewQrPlaceholder'>
                          <span className='previewQrPlaceholderText'>
                            {item.placeholder}
                          </span>
                        </div>
                      )
                      : null}
                  </div>
                );
              })}
            </div>
          )
          : null)}
    </>
  );

  const hasExtras = previewSource?.kind === 'a2ui'
    || !!previewQrPlaceholder
    || previewQrCards.length > 0;

  return (
    <PreviewPanelPreviewModeContext.Provider value={{ mode, setMode }}>
      <PreviewPanelRenderContext.Provider value={renderContext}>
        <div
          className={className
            ? `${className}${isFullscreen ? ' previewPanelFullscreen' : ''}`
            : (isFullscreen
              ? 'previewPanel previewPanelFullscreen'
              : 'previewPanel')}
          style={panelStyle}
        >
          <CopyToast toast={copyToast} />
          <div className='previewPanelHeader'>
            <span className='previewPanelTitle'>{title}</span>
            {headerAfterTitle}
            <div className='spacer' />
            {showPreviewModeSwitch
              ? <PreviewModeSwitch mode={mode} onChange={setMode} />
              : null}
            {hasExtras
              ? (
                <button
                  type='button'
                  className='previewInfoBtn'
                  onClick={() => setShareOpen(true)}
                  title='Open on phone'
                  aria-label='Open this preview on a phone'
                >
                  <svg
                    viewBox='0 0 24 24'
                    width='16'
                    height='16'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    aria-hidden='true'
                  >
                    <rect
                      x='6'
                      y='2'
                      width='12'
                      height='20'
                      rx='2.5'
                      ry='2.5'
                    />
                    <line x1='12' y1='18' x2='12.01' y2='18' />
                  </svg>
                </button>
              )
              : null}
            <button
              type='button'
              className='previewExpandBtn'
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? 'Exit fullscreen' : 'Expand preview'}
            >
              {isFullscreen ? '\u2715' : '\u2922'}
            </button>
          </div>
          {beforeBody}
          {showSimulationBar
              && previewSource
              && previewSource.kind !== 'placeholder'
            ? (
              <PreviewSimulationBar
                speed={speed}
                speedInputId={speedInputId}
                onSpeedChange={setSpeed}
                label='Simulated'
                infoTooltip={previewSource.kind === 'a2ui'
                  ? (
                    <div>
                      Pre-recorded messages replayed at simulated speed. No AI
                      model is running.
                    </div>
                  )
                  : undefined}
                infoTooltipOpen={simulationInfoOpen}
                onToggleInfoTooltip={() => setSimulationInfoOpen((v) => !v)}
              />
            )
            : null}
          <div className={bodyClass}>{children}</div>
          <div className='previewPanelExtras'>{renderExtras()}</div>
          {hasExtras
            ? (
              <Drawer.Root
                open={shareOpen}
                onOpenChange={setShareOpen}
              >
                <Drawer.Portal>
                  <Drawer.Overlay className='previewShareOverlay' />
                  <Drawer.Content className='previewShareSheet'>
                    <div className='previewShareHandle' aria-hidden='true' />
                    <Drawer.Title className='previewShareTitle'>
                      Preview info
                    </Drawer.Title>
                    <Drawer.Description className='previewShareDescription'>
                      Components rendered and links to share this preview.
                    </Drawer.Description>
                    <div className='previewShareBody'>{renderExtras()}</div>
                  </Drawer.Content>
                </Drawer.Portal>
              </Drawer.Root>
            )
            : null}
          {afterBody}
        </div>
      </PreviewPanelRenderContext.Provider>
    </PreviewPanelPreviewModeContext.Provider>
  );
}
