export interface ProbeResult {
  id: string;
  status: string;
  ok: boolean;
  lateArtifactCount: number | null;
}

export interface ProbeReport {
  ok: boolean;
  verdict: string;
  error?: string;
  results: ProbeResult[];
}

export function buildProbeReport(input: {
  descriptors?: Record<string, unknown>[];
  results?: Record<string, unknown>[];
  uiConformance: Record<string, unknown>;
  uiConformanceError?: string;
  fatalError?: string;
}): ProbeReport;

export function waitForExactResponse(
  page: {
    on(name: string, listener: (value: unknown) => void): void;
    off(name: string, listener: (value: unknown) => void): void;
  },
  matchesPathname: (pathname: string) => boolean,
  timeoutMs?: number,
): { promise: Promise<unknown>; cancel(): void };

export function waitForDurableTerminal(
  hasUniqueTerminal: () => boolean,
  timeoutMs?: number,
): Promise<void>;

export function waitForConversationRender(
  page: unknown,
  previousForm: unknown,
  conversationId: string,
): Promise<void>;

export function submitWithOptimisticCancellation(
  page: unknown,
  conversationId: string,
  prompt: string,
): Promise<{ turnId: string; cancellationUrl: string; response: unknown }>;
