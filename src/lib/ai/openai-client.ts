import 'server-only';

import OpenAI from 'openai';

export type AiMode = 'mock' | 'real';

let openAIClient: OpenAI | null = null;

export function getAiMode(): AiMode {
  return process.env.AI_MODE?.trim().toLowerCase() === 'real' ? 'real' : 'mock';
}

export function getOpenAIClient(): OpenAI | null {
  if (getAiMode() !== 'real') return null;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'AI_MODE is set to "real", but OPENAI_API_KEY is missing. Configure OPENAI_API_KEY on the server or use AI_MODE="mock".'
    );
  }

  openAIClient ??= new OpenAI({apiKey});
  return openAIClient;
}
