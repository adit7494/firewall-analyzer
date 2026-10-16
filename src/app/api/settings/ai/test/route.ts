/**
 * API Route: POST /api/settings/ai/test
 * Tests the connection to the AI provider using the provided configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { testAIConnection, getAIConfig, AIClientConfig } from '@/lib/engine/ai-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<AIClientConfig>;

    // If an apiKey is provided (not masked), use the override config from the request body.
    // Otherwise fall back to what's stored in the DB.
    let configToTest: AIClientConfig | undefined;

    if (body.provider && body.baseUrl && body.model && body.apiKey && !body.apiKey.includes('•')) {
      configToTest = {
        provider: body.provider,
        baseUrl: body.baseUrl.replace(/\/$/, ''),
        apiKey: body.apiKey,
        model: body.model,
      };
    }

    const result = await testAIConnection(configToTest);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      success: false,
      latencyMs: 0,
      model: '',
      error: (err as Error).message,
    }, { status: 500 });
  }
}
