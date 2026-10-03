/**
 * Transcript Source Adapter layer.
 *
 * Separates "how we obtain the original chat transcript" from the core
 * knowledge-capture model. The core model (Transcript / WorkRecord /
 * AgentSession) never depends on a specific platform; each platform's capability
 * lives in its own adapter.
 *
 * Honesty rule (see AGENTS.md): an adapter MUST return `unavailable` when the
 * platform offers no programmatic transcript. It must NEVER fabricate a full
 * transcript from memory or from an Agent's own summary.
 */

export type TranscriptStatus = 'full' | 'partial' | 'unavailable';

export interface TranscriptCaptureResult {
  status: TranscriptStatus;
  /** Raw original transcript text. Only present when status !== 'unavailable'. */
  content?: string;
  /** Which adapter produced this result (codebuddy | codex | chatgpt | imported | test | manual ...). */
  sourceType: string;
  /** Platform session id, if the source can provide it. */
  sourceSessionId?: string;
  /** When the capture happened. */
  capturedAt: string;
  /** How complete the original transcript is. */
  completeness: 'full' | 'partial' | 'unknown';
}

export interface TranscriptCaptureContext {
  agentType: string;
  agentSessionId?: string;
  /**
   * Test / explicit override: when provided, the test adapter is used to treat
   * `content` as a genuinely captured transcript. This is the only sanctioned
   * way to exercise the "full transcript available" path in tests; production
   * adapters never invent content.
   */
  override?: {
    content: string;
    sourceSessionId?: string;
    completeness?: 'full' | 'partial';
    sourceType?: string;
  };
}

export interface TranscriptSource {
  sourceType: string;
  /** Whether this source can programmatically obtain the transcript now. */
  canCapture(_ctx: TranscriptCaptureContext): Promise<boolean>;
  capture(ctx: TranscriptCaptureContext): Promise<TranscriptCaptureResult>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unavailable(sourceType: string): TranscriptCaptureResult {
  return {
    status: 'unavailable',
    sourceType,
    capturedAt: nowIso(),
    completeness: 'unknown',
  };
}

export const testTranscriptSource: TranscriptSource = {
  sourceType: 'test',
  async canCapture(ctx) {
    return !!ctx.override?.content;
  },
  async capture(ctx) {
    const content = ctx.override?.content;
    if (!content) return unavailable('test');
    return {
      status: ctx.override?.completeness ?? 'full',
      content,
      sourceType: ctx.override?.sourceType ?? 'test',
      sourceSessionId: ctx.override?.sourceSessionId,
      capturedAt: nowIso(),
      completeness: ctx.override?.completeness ?? 'full',
    };
  },
};

export const importedTranscriptSource: TranscriptSource = {
  sourceType: 'imported',
  async canCapture(ctx) {
    return !!ctx.override?.content;
  },
  async capture(ctx) {
    const content = ctx.override?.content;
    if (!content) return unavailable('imported');
    return {
      status: ctx.override?.completeness ?? 'full',
      content,
      sourceType: 'imported',
      sourceSessionId: ctx.override?.sourceSessionId,
      capturedAt: nowIso(),
      completeness: ctx.override?.completeness ?? 'full',
    };
  },
};

export const manualTranscriptSource: TranscriptSource = {
  sourceType: 'manual',
  async canCapture(ctx) {
    return !!ctx.override?.content;
  },
  async capture(ctx) {
    const content = ctx.override?.content;
    if (!content) return unavailable('manual');
    return {
      status: ctx.override?.completeness ?? 'full',
      content,
      sourceType: 'manual',
      sourceSessionId: ctx.override?.sourceSessionId,
      capturedAt: nowIso(),
      completeness: ctx.override?.completeness ?? 'full',
    };
  },
};

/**
 * Platform adapters. These reflect the REAL capability of each environment as of
 * implementation time. If a platform later exposes a transcript API, only this
 * adapter changes — the core model stays stable.
 *
 * CodeBuddy / Codex / ChatGPT: in the current runtime there is NO programmatic
 * transcript API available to the Agent. We therefore return `unavailable`
 * honestly. This is a supported, first-class state: the closure still produces a
 * Work Record and the Knowledge Gate does NOT fail.
 */
export const codebuddyTranscriptSource: TranscriptSource = {
  sourceType: 'codebuddy',
  async canCapture() {
    return false;
  },
  async capture() {
    return unavailable('codebuddy');
  },
};

export const codexTranscriptSource: TranscriptSource = {
  sourceType: 'codex',
  async canCapture() {
    return false;
  },
  async capture() {
    return unavailable('codex');
  },
};

export const chatgptTranscriptSource: TranscriptSource = {
  sourceType: 'chatgpt',
  async canCapture() {
    return false;
  },
  async capture() {
    return unavailable('chatgpt');
  },
};

const PLATFORM_SOURCES: Record<string, TranscriptSource> = {
  codebuddy: codebuddyTranscriptSource,
  codex: codexTranscriptSource,
  chatgpt: chatgptTranscriptSource,
};

export function selectTranscriptSource(agentType: string): TranscriptSource {
  return PLATFORM_SOURCES[agentType] ?? codebuddyTranscriptSource;
}

/**
 * Entry point used by the closure. If an explicit override is present (test or
 * manual/imported injection), the corresponding adapter is used; otherwise the
 * platform adapter for the Agent type is consulted (and will report honestly).
 */
export async function captureTranscript(ctx: TranscriptCaptureContext): Promise<TranscriptCaptureResult> {
  if (ctx.override?.content) {
    if (ctx.override.sourceType === 'imported') return importedTranscriptSource.capture(ctx);
    if (ctx.override.sourceType === 'manual') return manualTranscriptSource.capture(ctx);
    return testTranscriptSource.capture(ctx);
  }
  const source = selectTranscriptSource(ctx.agentType);
  const can = await source.canCapture(ctx);
  if (!can) return unavailable(source.sourceType);
  return source.capture(ctx);
}
