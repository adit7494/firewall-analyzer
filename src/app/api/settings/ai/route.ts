/**
 * API Route: /api/settings/ai
 * Manages AI engine configuration stored in SQLite via AppSettings model.
 *
 * GET  /api/settings/ai        — Returns current config (API key masked)
 * POST /api/settings/ai        — Save new config
 * POST /api/settings/ai/test   — Test connection to the configured provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, saveAIConfig, testAIConnection, AIClientConfig } from '@/lib/engine/ai-client';

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}

/** GET /api/settings/ai — returns current config with masked API key */
export async function GET() {
  try {
    const config = await getAIConfig();
    if (!config) {
      return NextResponse.json({ configured: false, config: null });
    }
    return NextResponse.json({
      configured: true,
      config: {
        ...config,
        apiKey: maskApiKey(config.apiKey),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST /api/settings/ai — saves AI configuration */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<AIClientConfig>;

    // If apiKey is masked (user didn't change it), load the real key from DB
    let apiKey = body.apiKey ?? '';
    if (apiKey.includes('•')) {
      const existing = await getAIConfig();
      apiKey = existing?.apiKey ?? '';
    }

    if (!body.provider || !body.baseUrl || !body.model || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, baseUrl, apiKey, model.' },
        { status: 400 }
      );
    }

    const config: AIClientConfig = {
      provider: body.provider,
      baseUrl: body.baseUrl.replace(/\/$/, ''), // strip trailing slash
      apiKey,
      model: body.model,
    };

    await saveAIConfig(config);

    return NextResponse.json({ success: true, message: 'AI configuration saved successfully.' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
