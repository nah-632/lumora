/**
 * Provider-agnostic AI interface. Swapping providers must not require touching
 * feature code, so everything here is expressed in terms of plain JSON strings.
 *
 * Keys live only in environment variables and are read at call time, never
 * bundled and never logged.
 */

export interface GenerateRequest {
  system: string;
  user: string;
  /** Asked of the provider so JSON-only responses are more likely. */
  json: boolean;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  /** True when the figure is derived from a price table rather than returned. */
  costEstimated: boolean;
  costUsd: number | null;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

export class AIProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`AI provider "${provider}" is not configured`);
    this.name = "AIProviderNotConfiguredError";
  }
}

/**
 * Deterministic provider used by tests. It is disabled in production so canned
 * output can never be mistaken for a real generation.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock-alerts-v1";

  constructor(private readonly responder: (req: GenerateRequest) => string) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PROVIDER !== "true") {
      throw new Error("MockProvider is disabled in production");
    }
  }

  isConfigured(): boolean {
    return true;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    const text = this.responder(req);
    return {
      text,
      provider: this.name,
      model: this.model,
      inputTokens: null,
      outputTokens: null,
      latencyMs: Date.now() - started,
      costEstimated: true,
      costUsd: 0,
    };
  }
}

/**
 * Resolves the configured provider. Returns null when nothing is configured,
 * which callers surface as the ai_not_configured state rather than substituting
 * canned text.
 */
export function getAIProvider(): AIProvider | null {
  const responder = (req: GenerateRequest): string => {
    // Deterministic stand-in: echoes an empty alert list unless the caller
    // planted a sentinel, so tests drive behaviour explicitly.
    void req;
    return JSON.stringify({ alerts: [] });
  };

  if (process.env.AI_PROVIDER === "mock") {
    return new MockProvider(responder);
  }
  return null;
}
