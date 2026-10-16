/**
 * AI Client — OpenAI-compatible wrapper.
 * Reads configuration from the AppSettings table in SQLite (managed via Settings UI).
 * Supports: OpenAI, Google Gemini (via OpenAI-compatible endpoint), Azure OpenAI,
 *           Ollama (local/offline), and any custom OpenAI-compatible provider.
 */

import prisma from '@/lib/db/prisma';

export type AIProvider = 'openai' | 'gemini' | 'azure' | 'ollama' | 'custom';

export interface AIClientConfig {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Provider preset base URLs.
 */
export const PROVIDER_PRESETS: Record<AIProvider, { baseUrl: string; modelSuggestions: string[] }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    modelSuggestions: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  },
  gemini: {
    // Google Gemini OpenAI-compatible endpoint
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelSuggestions: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  },
  azure: {
    baseUrl: 'https://<your-resource>.openai.azure.com/openai/deployments/<deployment>',
    modelSuggestions: ['gpt-4o', 'gpt-4o-mini'],
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    modelSuggestions: ['llama3.2', 'mistral', 'phi3', 'gemma2'],
  },
  custom: {
    baseUrl: '',
    modelSuggestions: [],
  },
};

/**
 * Reads the current AI configuration from the database.
 * Returns null if not configured (no API key set).
 */
export async function getAIConfig(): Promise<AIClientConfig | null> {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'app-settings' },
    });
    if (!settings || settings.ai_config === '{}' || !settings.ai_config) {
      return null;
    }
    const config = JSON.parse(settings.ai_config) as Partial<AIClientConfig>;
    if (!config.apiKey || !config.baseUrl || !config.model) {
      return null;
    }
    return config as AIClientConfig;
  } catch {
    return null;
  }
}

/**
 * Helper to extract root cause from native fetch errors (like ECONNREFUSED).
 */
function getFetchErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as any).cause;
    if (cause && cause.message) {
      return `${err.message} (${cause.message})`;
    }
    if (cause && cause.code) {
      return `${err.message} (${cause.code})`;
    }
    return err.message;
  }
  return String(err);
}

/**
 * Saves AI configuration to the database.
 */
export async function saveAIConfig(config: AIClientConfig): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: 'app-settings' },
    create: { id: 'app-settings', ai_config: JSON.stringify(config) },
    update: { ai_config: JSON.stringify(config) },
  });
}

/**
 * Returns true if AI is configured and ready to use.
 */
export async function isAIConfigured(): Promise<boolean> {
  const config = await getAIConfig();
  return config !== null;
}

/**
 * Sends a chat completion request to the configured AI provider.
 * Uses the OpenAI-compatible Chat Completions API format — works for all providers.
 *
 * @param systemPrompt  The system-level instruction (who the AI is, what it must do)
 * @param userPrompt    The user message containing the config block to analyze
 * @returns             Raw text response from the AI
 * @throws              Error if AI is not configured or the request fails
 */
export interface AICallResult {
  content: string;
  latencyMs: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callAI(systemPrompt: string, userPrompt: string): Promise<AICallResult> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error('AI engine is not configured. Please configure it in Settings > AI Engine.');
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,         // deterministic — same config = same result
    stream: false,          // explicitly request no streaming
    response_format: { type: 'json_object' },  // force JSON output where supported
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    // Anti-bot & Tunnel bypass headers
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Bypass-Tunnel-Reminder': 'true',
    'ngrok-skip-browser-warning': 'true'
  };

  // Azure OpenAI uses a different header for API key
  if (config.provider === 'azure') {
    headers['api-key'] = config.apiKey;
    delete headers['Authorization'];
  }

  // Allow self-signed certs for custom/local tunnels
  const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (config.provider === 'custom' || config.provider === 'ollama') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const start = Date.now();
  const maxRetries = 3;
  let lastError: Error | null = null;
  let response: Response | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isTransient = response.status === 429 || response.status >= 500;
        lastError = new Error(`AI provider error (HTTP ${response.status}): ${errorText}`);

        if (isTransient && attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1200 + Math.random() * 500;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }
      break;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1200 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(`Connection failed: ${getFetchErrorMessage(err)}`);
    } finally {
      if (config.provider === 'custom' || config.provider === 'ollama') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
      }
    }
  }

  if (!response || !response.ok) {
    throw lastError ?? new Error('AI provider request failed.');
  }

  const rawText = await response.text();
  let content = '';
  const latencyMs = Date.now() - start;
  let usage: AICallResult['usage'] = undefined;

  try {
    // Try standard JSON parsing first
    const data = JSON.parse(rawText) as {
      choices?: { message?: { content?: string } }[];
      error?: { message: string };
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    if (data.error) {
      throw new Error(`AI provider error: ${data.error.message}`);
    }

    content = data.choices?.[0]?.message?.content || '';
    if (data.usage) {
      usage = data.usage;
    }
  } catch (parseError) {
    // Fallback: If provider stubbornly returns SSE stream even when stream=false
    if (rawText.trim().startsWith('data:')) {
      const lines = rawText.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('data:') && !line.includes('[DONE]')) {
          try {
            const jsonStr = line.trim().replace(/^data:\s*/, '');
            const chunk = JSON.parse(jsonStr);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              content += delta;
            }
            // Some providers send usage in the last chunk
            if (chunk.usage) {
              usage = chunk.usage;
            }
          } catch (e) {
            // ignore malformed chunk
          }
        }
      }
    } else {
      throw new Error(`Invalid JSON from AI provider: ${rawText.slice(0, 100)}...`);
    }
  }

  if (!content) {
    throw new Error('AI provider returned an empty response.');
  }

  return { content, latencyMs, usage };
}

/**
 * Tests the connection to the configured AI provider.
 * Sends a minimal prompt and checks for a valid response.
 * @returns Latency in milliseconds and the model name used
 */
export async function testAIConnection(configOverride?: AIClientConfig): Promise<{
  success: boolean;
  latencyMs: number;
  model: string;
  error?: string;
}> {
  const config = configOverride ?? (await getAIConfig());
  if (!config) {
    return { success: false, latencyMs: 0, model: '', error: 'No AI configuration found.' };
  }

  const start = Date.now();
  try {
    const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const body = {
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a test assistant. Respond with valid JSON only.' },
        { role: 'user', content: 'Respond with: {"ok": true}' },
      ],
      temperature: 0,
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      // Anti-bot & Tunnel bypass headers
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Bypass-Tunnel-Reminder': 'true',
      'ngrok-skip-browser-warning': 'true'
    };
    if (config.provider === 'azure') {
      headers['api-key'] = config.apiKey;
      delete headers['Authorization'];
    }

    // Allow self-signed certs for custom/local tunnels
    const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (config.provider === 'custom' || config.provider === 'ollama') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (err) {
      throw new Error(getFetchErrorMessage(err));
    } finally {
      if (config.provider === 'custom' || config.provider === 'ollama') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
      }
    }
    
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, latencyMs, model: config.model, error: `HTTP ${response.status}: ${errorText.slice(0, 200)}` };
    }

    return { success: true, latencyMs, model: config.model };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { success: false, latencyMs, model: config.model, error: getFetchErrorMessage(err) };
  }
}
