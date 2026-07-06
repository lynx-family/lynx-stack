// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  createContext,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { Drawer } from 'vaul';

import { Button } from './Button.js';
import { CopyToast, useCopyToast } from './CopyToast.js';
import { Maximize2, Minimize2, Smartphone } from './Icon.js';
import { PreviewSimulationBar } from './PreviewSimulationBar.js';
import { QrCode } from './QrCode.js';
import { componentsByMessage } from '../demos.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';
import { publishOpenUIPayload } from '../utils/publishPayload.js';
import {
  buildOpenUIRenderUrl,
  buildRenderUrl,
  canInlineOpenUIRenderUrl,
} from '../utils/renderUrl.js';

declare const __A2UI_PLAYGROUND_CLIENT_PAYLOAD_STORE__: boolean;

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

export interface PreviewPanelMetricsContextValue {
  metricId: string;
  onFrameSrcChange: (src: string) => void;
}

export const PreviewPanelMetricsContext = createContext<
  PreviewPanelMetricsContextValue | null
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
  messagesUrl?: string;
  actionMocks?: Record<string, unknown>;
  actionMocksUrl?: string;
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
  playbackMode?: boolean;
}

interface PlaceholderPreviewSource {
  kind: 'placeholder';
  item: PreviewQrItem;
}

export type PreviewPanelSource =
  | A2UIPreviewSource
  | OpenUIPreviewSource
  | PlaceholderPreviewSource;

export type PreviewMetricName = 'fcp' | 'fmp' | 'tti' | 'render';

type PreviewMetrics = Partial<Record<PreviewMetricName, number>>;

interface PreviewMetricMessage {
  type: 'A2UI_PREVIEW_METRIC';
  metricId: string;
  metric: PreviewMetricName;
  value: number;
}

export interface PreviewPanelMetricItem {
  key: string;
  label: string;
  description?: string;
  title?: string;
  value?: number;
}

const PREVIEW_METRIC_ITEMS: Array<{
  key: PreviewMetricName;
  label: string;
  description: string;
  title: string;
}> = [
  {
    key: 'fcp',
    label: 'FCP',
    title: 'First Contentful Paint',
    description:
      'Time from preview load until the first visible content is painted.',
  },
  {
    key: 'fmp',
    label: 'FMP',
    title: 'First Meaningful Paint',
    description:
      'Time until the first meaningful A2UI content is delivered and painted.',
  },
  {
    key: 'tti',
    label: 'TTI',
    title: 'Time to Interactive',
    description:
      'Time until the preview finishes initial rendering and is idle enough for actions.',
  },
];

interface PreviewPanelProps {
  className?: string;
  style?: CSSProperties;
  title: ReactNode;
  headerAfterTitle?: ReactNode;
  previewSource?: PreviewPanelSource;
  showPreviewModeSwitch?: boolean;
  showSimulationBar?: boolean;
  /** When provided, overrides PreviewPanel's internal speed state. The
   *  parent becomes the single source of truth (e.g. a unified speed slider
   *  living outside PreviewPanel).
   */
  speed?: number;
  onSpeedChange?: (value: number) => void;
  beforeBody?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
  afterBody?: ReactNode;
  extraMetrics?: PreviewPanelMetricItem[];
  onPreviewMetric?: (metric: PreviewMetricName, value: number) => void;
  previewInfoHint?: ReactNode;
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

function absoluteUrl(url: string, origin: string): string {
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
}

function shouldUseClientPayloadStore(): boolean {
  return __A2UI_PLAYGROUND_CLIENT_PAYLOAD_STORE__;
}

async function publishOpenUIRawTextToClientStore(
  baseUrl: string,
  rawText: string,
): Promise<string> {
  const payloadOrigin = new URL(baseUrl).origin;
  const res = await window.fetch(`${payloadOrigin}/__openui_payload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText }),
  });
  if (!res.ok) {
    throw new Error('Failed to publish local OpenUI raw text');
  }
  const data = (await res.json()) as { rawTextUrl?: unknown };
  if (typeof data.rawTextUrl !== 'string') {
    throw new Error('Invalid local OpenUI payload response');
  }
  return absoluteUrl(data.rawTextUrl, payloadOrigin);
}

function isPreviewMetricName(value: unknown): value is PreviewMetricName {
  return value === 'fcp'
    || value === 'fmp'
    || value === 'tti'
    || value === 'render';
}

function isPreviewMetricMessage(
  data: unknown,
): data is PreviewMetricMessage {
  if (!data || typeof data !== 'object') return false;
  const payload = data as Partial<PreviewMetricMessage>;
  return payload.type === 'A2UI_PREVIEW_METRIC'
    && typeof payload.metricId === 'string'
    && isPreviewMetricName(payload.metric)
    && typeof payload.value === 'number'
    && Number.isFinite(payload.value);
}

function formatMetricValue(value: number | undefined): string {
  return typeof value === 'number' ? `${Math.round(value)}ms` : '...';
}

// Vertical split between the phone preview body (top, flex:1) and the
// extras pane (bottom, COMPONENTS + QR cards). The pane has an explicit
// height that the user can drag; the body absorbs whatever is left.
const EXTRAS_HEIGHT_DEFAULT = 280;
const EXTRAS_HEIGHT_MIN = 80;
const EXTRAS_BODY_MIN = 200;
const EXTRAS_HEIGHT_STORAGE_KEY = 'a2ui-playground:preview-extras-height';

function readStoredExtrasHeight(): number {
  if (typeof window === 'undefined') return EXTRAS_HEIGHT_DEFAULT;
  const raw = window.localStorage.getItem(EXTRAS_HEIGHT_STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : EXTRAS_HEIGHT_DEFAULT;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function PreviewPanel(props: PreviewPanelProps) {
  const {
    afterBody,
    beforeBody,
    bodyClassName,
    children,
    className,
    extraMetrics = [],
    headerAfterTitle,
    onPreviewMetric,
    onSpeedChange,
    previewSource,
    previewInfoHint,
    showPreviewModeSwitch = false,
    showSimulationBar = true,
    speed: speedProp,
    style,
    title,
  } = props;
  const [mode, setMode] = useState<PreviewMode>('phone');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Mobile threshold matches the rest of the app (MobileTabBar, .brand hide,
  // compact padding). Above this the panel has room to render extras inline;
  // below it the Vaul bottom sheet takes over for a one-handed UX.
  const isCompactViewport = useMediaQuery('(max-width: 720px)');
  const panelRef = useRef<HTMLDivElement>(null);
  const [extrasHeight, setExtrasHeight] = useState<number>(
    readStoredExtrasHeight,
  );
  const extrasHeightRef = useRef(extrasHeight);
  extrasHeightRef.current = extrasHeight;
  const [isResizingExtras, setIsResizingExtras] = useState(false);
  const [internalSpeed, setInternalSpeed] = useState(1);
  // If the parent supplies a speed, it owns it; otherwise we keep our own.
  const speed = speedProp ?? internalSpeed;
  const setSpeed = onSpeedChange ?? setInternalSpeed;
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
  const rawMetricId = useId();
  const metricId = useMemo(
    () => rawMetricId.replace(/[^\w-]/g, ''),
    [rawMetricId],
  );
  const [previewMetrics, setPreviewMetrics] = useState<PreviewMetrics>({});
  const [metricFrameSrc, setMetricFrameSrc] = useState('');
  const metricFrameSrcRef = useRef('');
  const handleMetricFrameSrcChange = useCallback((src: string) => {
    if (metricFrameSrcRef.current === src) return;
    metricFrameSrcRef.current = src;
    setMetricFrameSrc(src);
    setPreviewMetrics({});
  }, []);

  // Vertical drag on the resizer above the extras pane. Reads the current
  // height from a ref so the handler stays stable across renders, then
  // persists the final value once the user releases.
  const handleExtrasResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!panelRef.current) return;
      event.preventDefault();

      const startY = event.clientY;
      const startHeight = extrasHeightRef.current;
      const panelHeight = panelRef.current.getBoundingClientRect().height;
      // Cap to the smaller of (room left for the body) and (natural content
      // height + a little breathing room). Without the content cap the user
      // can drag into wasted empty space below the QR cards.
      const extrasEl = panelRef.current.querySelector<HTMLDivElement>(
        '.previewPanelExtras',
      );
      const contentNatural = extrasEl
        ? extrasEl.scrollHeight + 12
        : Number.POSITIVE_INFINITY;
      const maxHeight = Math.max(
        EXTRAS_HEIGHT_MIN,
        Math.min(panelHeight - EXTRAS_BODY_MIN, contentNatural),
      );

      setIsResizingExtras(true);
      document.body.dataset.panelResize = 'vertical';

      const handleMove = (moveEvent: PointerEvent) => {
        const next = clamp(
          startHeight - (moveEvent.clientY - startY),
          EXTRAS_HEIGHT_MIN,
          maxHeight,
        );
        setExtrasHeight(next);
      };

      const handleEnd = () => {
        setIsResizingExtras(false);
        delete document.body.dataset.panelResize;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleEnd);
        window.removeEventListener('pointercancel', handleEnd);
        try {
          window.localStorage.setItem(
            EXTRAS_HEIGHT_STORAGE_KEY,
            String(extrasHeightRef.current),
          );
        } catch {
          // ignore quota / disabled storage
        }
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleEnd);
      window.addEventListener('pointercancel', handleEnd);
    },
    [],
  );

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
  const metricsContext = useMemo<PreviewPanelMetricsContextValue>(
    () => ({ metricId, onFrameSrcChange: handleMetricFrameSrcChange }),
    [handleMetricFrameSrcChange, metricId],
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
    let expectedOrigin = '';
    if (metricFrameSrc) {
      try {
        expectedOrigin = new URL(metricFrameSrc, window.location.href).origin;
      } catch {
        expectedOrigin = '';
      }
    }

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (expectedOrigin && event.origin !== expectedOrigin) return;
      if (!isPreviewMetricMessage(event.data)) return;
      if (event.data.metricId !== metricId) return;

      const { metric, value } = event.data;
      onPreviewMetric?.(metric, value);
      setPreviewMetrics((current) => {
        if (current[metric] === value) {
          return current;
        }
        return {
          ...current,
          [metric]: value,
        };
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [metricFrameSrc, metricId, onPreviewMetric]);

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
      const useClientPayloadStore = shouldUseClientPayloadStore();
      const canSharePayload = !!previewSource.demoId
        || !!previewSource.messagesUrl
        || useClientPayloadStore;
      const hasInlineMessages = Array.isArray(previewSource.messages)
        ? previewSource.messages.length > 0
        : previewSource.messages !== undefined;
      if (!canSharePayload && !hasInlineMessages) {
        setRenderUrl('');
        setRenderShareUrl('');
        setLynxDevUrl('');
        return;
      }

      const url = buildRenderUrl(
        {
          protocol: previewSource.protocol,
          demoUrl: previewSource.demoUrl ?? DEFAULT_A2UI_DEMO_URL,
          messagesUrl: previewSource.messagesUrl,
          messages: previewSource.messages,
          actionMocksUrl: previewSource.actionMocksUrl,
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
          messagesUrl: previewSource.messagesUrl,
          messages: previewSource.messages,
          actionMocksUrl: previewSource.actionMocksUrl,
          actionMocks: previewSource.actionMocks,
          theme: previewSource.theme,
          demoId: previewSource.demoId,
          speed,
        },
        shareBaseUrl,
      );
      setRenderUrl(url);
      setRenderShareUrl(canSharePayload ? shareUrl : '');

      if (!canSharePayload) {
        setLynxDevUrl('');
        return;
      }

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
      } else if (previewSource.messagesUrl) {
        uInline.searchParams.set('messagesUrl', previewSource.messagesUrl);
        uInline.searchParams.delete('messages');
        if (previewSource.actionMocksUrl) {
          uInline.searchParams.set(
            'actionMocksUrl',
            previewSource.actionMocksUrl,
          );
          uInline.searchParams.delete('actionMocks');
        } else if (previewSource.actionMocks) {
          uInline.searchParams.set(
            'actionMocks',
            JSON.stringify(previewSource.actionMocks),
          );
          uInline.searchParams.delete('actionMocksUrl');
        }
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

      if (
        previewSource.demoId
        || previewSource.messagesUrl
        || !useClientPayloadStore
      ) {
        return;
      }

      void (async () => {
        try {
          const payloadOrigin = new URL(baseUrl).origin;
          const res = await window.fetch(`${payloadOrigin}/__a2ui_payload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: previewSource.messages,
              actionMocks: previewSource.actionMocks,
            }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            messagesUrl?: string;
            actionMocksUrl?: string;
          };

          if (seq !== buildSeqRef.current) return;
          if (typeof data.messagesUrl !== 'string') return;

          const messagesUrl = absoluteUrl(data.messagesUrl, payloadOrigin);
          const actionMocksUrl = typeof data.actionMocksUrl === 'string'
            ? absoluteUrl(data.actionMocksUrl, payloadOrigin)
            : undefined;

          const shortUrl = buildRenderUrl(
            {
              protocol: previewSource.protocol,
              demoUrl: previewSource.demoUrl ?? DEFAULT_A2UI_DEMO_URL,
              messagesUrl,
              messages: previewSource.messages,
              actionMocksUrl,
              theme: previewSource.theme,
              speed,
              playbackMode: previewSource.playbackMode,
            },
            baseUrl,
          );
          const shortShareUrl = buildRenderUrl(
            {
              protocol: previewSource.protocol,
              demoUrl: previewSource.demoUrl ?? DEFAULT_A2UI_DEMO_URL,
              messagesUrl,
              messages: previewSource.messages,
              actionMocksUrl,
              theme: previewSource.theme,
              speed,
            },
            shareBaseUrl,
          );
          setRenderUrl(shortUrl);
          setRenderShareUrl(shortShareUrl);

          const u = new URL(rspeedyDevUrl);
          if (speed !== 1) {
            u.searchParams.set('speed', String(speed));
          }
          u.searchParams.set('theme', previewSource.theme);
          u.searchParams.set('messagesUrl', messagesUrl);
          u.searchParams.delete('messages');
          if (actionMocksUrl) {
            u.searchParams.set('actionMocksUrl', actionMocksUrl);
            u.searchParams.delete('actionMocks');
          } else if (previewSource.actionMocks) {
            u.searchParams.set(
              'actionMocks',
              JSON.stringify(previewSource.actionMocks),
            );
            u.searchParams.delete('actionMocksUrl');
          } else {
            u.searchParams.delete('actionMocksUrl');
            u.searchParams.delete('actionMocks');
          }
          setLynxDevUrl(u.toString());
        } catch {
          // Keep the inline URLs above if the local dev payload store is unavailable.
        }
      })();
      return;
    }

    const inlineUrl = buildOpenUIRenderUrl({
      rawText: previewSource.rawText,
      speed,
      playbackMode: previewSource.playbackMode,
    }, baseUrl);
    const inlineShareUrl = buildOpenUIRenderUrl({
      rawText: previewSource.rawText,
      speed,
    }, shareBaseUrl);
    const canInline = canInlineOpenUIRenderUrl(inlineUrl)
      && canInlineOpenUIRenderUrl(inlineShareUrl);

    setRenderUrl(canInline ? inlineUrl : '');
    setRenderShareUrl(canInline ? inlineShareUrl : '');

    const setOpenUILynxDevUrl = (
      payload: { rawText: string } | { rawTextUrl: string },
    ) => {
      if (!rspeedyDevUrl) {
        setLynxDevUrl('');
        return;
      }
      const u = new URL(rspeedyDevUrl);
      u.pathname = u.pathname.replace('a2ui.lynx', 'openui.lynx');
      if ('rawTextUrl' in payload) {
        u.searchParams.set('rawTextUrl', payload.rawTextUrl);
        u.searchParams.delete('rawText');
      } else {
        u.searchParams.set('rawText', payload.rawText);
        u.searchParams.delete('rawTextUrl');
      }
      if (speed !== 1) {
        u.searchParams.set('speed', String(speed));
      }
      setLynxDevUrl(u.toString());
    };

    if (canInline) {
      setOpenUILynxDevUrl({ rawText: previewSource.rawText });
      return;
    }

    if (!previewSource.rawText) {
      setLynxDevUrl('');
      return;
    }

    setLynxDevUrl('');

    void (async () => {
      try {
        const published = shouldUseClientPayloadStore()
          ? {
            rawTextUrl: await publishOpenUIRawTextToClientStore(
              baseUrl,
              previewSource.rawText,
            ),
          }
          : await publishOpenUIPayload(previewSource.rawText);
        const rawTextUrl = published.rawTextUrl;
        if (seq !== buildSeqRef.current) return;

        setOpenUILynxDevUrl({ rawTextUrl });
        setRenderUrl(buildOpenUIRenderUrl({
          rawTextUrl,
          speed,
          playbackMode: previewSource.playbackMode,
        }, baseUrl));
        setRenderShareUrl(buildOpenUIRenderUrl({
          rawTextUrl,
          speed,
        }, shareBaseUrl));
      } catch (err) {
        console.warn('[openui] Failed to publish preview raw text', err);
      }
    })();
  }, [baseUrl, previewSource, rspeedyDevUrl, shareBaseUrl, speed]);

  useEffect(() => {
    if (!previewSource || previewSource.kind === 'placeholder') {
      setIsFullscreen(false);
      return;
    }

    // Auto-fullscreen on narrow but tab-less screens (721–980px). At ≤720
    // the host page renders a MobileTabBar, and the Preview tab already
    // gives the panel the full viewport — auto-fullscreening on top of
    // that hides the tab bar and traps the user behind an X button.
    if (
      typeof window !== 'undefined'
      && window.innerWidth > 720
      && window.innerWidth <= 980
    ) {
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

    const showQrCode = previewSource.kind !== 'a2ui'
      || !!previewSource.demoId
      || !!previewSource.messagesUrl;

    const cards: Array<{ key: string; item: PreviewQrItem }> = [];
    if (renderShareUrl) {
      cards.push({
        key: 'webPreview',
        item: {
          title: 'Web Preview',
          description: 'Opens in any mobile browser via Lynx for Web.',
          url: renderShareUrl,
          urlTitle: renderShareUrl,
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
          urlTitle: lynxDevUrl,
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

  const renderPreviewQrExtras = () => {
    if (previewQrPlaceholder) {
      return (
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
      );
    }

    if (previewQrCards.length > 0) {
      return (
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
                      {copied ? 'Copied' : (copyFailed ? 'Failed' : 'Copy')}
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
      );
    }

    if (!previewInfoHint) return null;
    return (
      <div className='previewQrSection previewQrSectionEmpty'>
        <div className='previewQrEmptyState'>
          <div className='previewQrEmptyTitle'>
            Preview links are not ready yet
          </div>
          <div className='previewQrEmptyDesc'>
            {previewInfoHint}
          </div>
        </div>
      </div>
    );
  };

  const hasPreviewMetricSource = previewSource !== undefined
    && previewSource.kind !== 'placeholder';
  const hasPreviewMetrics = hasPreviewMetricSource || extraMetrics.length > 0;

  const renderPreviewMetrics = () => {
    if (!hasPreviewMetrics) return null;

    const renderMetricItem = (item: PreviewPanelMetricItem) => {
      const value = item.value;
      const description = item.description ?? item.title;
      return (
        <span
          key={item.key}
          className='previewMetricItem'
          title={description ?? item.title}
          tabIndex={description ? 0 : undefined}
          aria-label={description
            ? `${item.label}: ${description}`
            : item.label}
        >
          <span className='previewMetricName'>{item.label}</span>
          <span
            className={value === undefined
              ? 'previewMetricValue previewMetricValuePending'
              : 'previewMetricValue'}
          >
            {formatMetricValue(value)}
          </span>
          {description
            ? (
              <span className='previewMetricTooltip' role='tooltip'>
                <span className='previewMetricTooltipTitle'>{item.title}</span>
                <span>{description}</span>
              </span>
            )
            : null}
        </span>
      );
    };

    return (
      <div className='previewMetricStack' aria-live='polite'>
        <span className='previewMetricLabel'>Metrics</span>
        <div className='previewMetricList'>
          {(hasPreviewMetricSource ? PREVIEW_METRIC_ITEMS : []).map(
            (item) => {
              return renderMetricItem({
                ...item,
                value: previewMetrics[item.key],
              });
            },
          )}
          {extraMetrics.map((item) => renderMetricItem(item))}
        </div>
      </div>
    );
  };

  // Computed once and reused in both the inline pane and the bottom sheet —
  // only one is mounted at a time (decided by `isCompactViewport`), so React
  // never instantiates QrCode twice or replays the tag-appear animation.
  const liveComponentsBlock = previewSource?.kind === 'a2ui'
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
    : null;
  const qrSectionBlock = renderPreviewQrExtras();
  const hasQrSection = !!qrSectionBlock;
  const hasExtras = !!liveComponentsBlock || hasQrSection || !!previewInfoHint;

  return (
    <PreviewPanelPreviewModeContext.Provider value={{ mode, setMode }}>
      <PreviewPanelMetricsContext.Provider value={metricsContext}>
        <PreviewPanelRenderContext.Provider value={renderContext}>
          <div
            ref={panelRef}
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
              {hasExtras && isCompactViewport
                ? (
                  <Button
                    variant='ghost'
                    size='sm'
                    iconOnly
                    iconBefore={Smartphone}
                    className='previewInfoBtn'
                    onClick={() => setShareOpen(true)}
                    title='Open on phone'
                    aria-label='Open this preview on a phone'
                  />
                )
                : null}
              <Button
                variant='ghost'
                size='sm'
                iconOnly
                iconBefore={isFullscreen ? Minimize2 : Maximize2}
                className='previewExpandBtn'
                onClick={() => setIsFullscreen((v) => !v)}
                title={isFullscreen ? 'Exit fullscreen' : 'Expand preview'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand preview'}
              />
            </div>
            {beforeBody}
            {renderPreviewMetrics()}
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
            {
              /* Inline (desktop) and bottom sheet (mobile) render the same
                live-components + QR blocks, but only one path is mounted at
                a time so QrCode's async toDataURL runs once and tag-appear
                doesn't replay. Inline gets a draggable resizer above the
                pane; the drawer scrolls naturally on mobile. */
            }
            {hasExtras && !isCompactViewport
              ? (
                <>
                  {hasQrSection
                    ? (
                      <div
                        className={isResizingExtras
                          ? 'previewPanelExtrasResizer active'
                          : 'previewPanelExtrasResizer'}
                        role='separator'
                        aria-orientation='horizontal'
                        aria-label='Resize preview and QR panes'
                        onPointerDown={handleExtrasResizeStart}
                      />
                    )
                    : null}
                  <div
                    className='previewPanelExtras'
                    style={hasQrSection
                      ? { height: `${extrasHeight}px` }
                      : undefined}
                  >
                    {liveComponentsBlock}
                    {qrSectionBlock}
                  </div>
                </>
              )
              : null}
            {hasExtras && isCompactViewport
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
                      <div className='previewShareBody'>
                        {liveComponentsBlock}
                        {qrSectionBlock}
                      </div>
                    </Drawer.Content>
                  </Drawer.Portal>
                </Drawer.Root>
              )
              : null}
            {afterBody}
          </div>
        </PreviewPanelRenderContext.Provider>
      </PreviewPanelMetricsContext.Provider>
    </PreviewPanelPreviewModeContext.Provider>
  );
}
