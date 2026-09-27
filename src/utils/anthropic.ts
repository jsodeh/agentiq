// @ts-ignore
import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: any = null;

export function initAnthropicClient(apiKey: string): any {
  anthropicClient = new (Anthropic as any)({ apiKey });
  return anthropicClient;
}

export function getAnthropicClient(): any {
  if (!anthropicClient) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    anthropicClient = new (Anthropic as any)({ apiKey });
  }
  return anthropicClient;
}

export async function sendMessage(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const client = getAnthropicClient();
  
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const textContent = response.content.find((c: { type: string; text?: string }) => c.type === 'text');
  return textContent && textContent.type === 'text' ? textContent.text : '';
}

