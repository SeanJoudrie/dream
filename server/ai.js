import Anthropic from '@anthropic-ai/sdk';
import { SCHEMAS, SYSTEMS } from './prompts.js';

export const MODEL = process.env.DREAM_MODEL || 'claude-opus-5';

// Hard caps on what a single request can carry, so a runaway client can't
// send a novel. A dream is short speech.
const MAX_TEXT = 20_000;
const MAX_DREAMS = 400;

export class BadRequest extends Error {}

const clip = (s, n = MAX_TEXT) => String(s ?? '').slice(0, n);

function corpus(dreams) {
  if (!Array.isArray(dreams)) throw new BadRequest('dreams must be a list');
  return dreams
    .slice(0, MAX_DREAMS)
    .map((d) => `<dream id="${clip(d.id, 40)}" date="${clip(d.date, 20)}">\n${clip(d.text, 6000)}\n</dream>`)
    .join('\n\n');
}

// Turns a client request into the user message for a task. The client only
// ever picks the task and supplies dreams; the instructions are ours.
export function buildUserMessage(task, input = {}) {
  switch (task) {
    case 'tidy': {
      const text = clip(input.text).trim();
      if (!text) throw new BadRequest('nothing to tidy');
      return `<transcript>\n${text}\n</transcript>`;
    }
    case 'repeats':
    case 'who':
      return corpus(input.dreams);
    case 'ask': {
      const q = clip(input.question, 500).trim();
      if (!q) throw new BadRequest('empty question');
      return `${corpus(input.dreams)}\n\n<looking_for>${q}</looking_for>`;
    }
    default:
      throw new BadRequest(`unknown task: ${task}`);
  }
}

export function createAI({ client = new Anthropic(), model = MODEL } = {}) {
  return async function run(task, input) {
    const user = buildUserMessage(task, input);
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: task === 'tidy' ? 'medium' : 'low',
        format: { type: 'json_schema', schema: SCHEMAS[task] },
      },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEMS[task],
      messages: [{ role: 'user', content: user }],
    });

    if (response.stop_reason === 'refusal') {
      const err = new Error('declined');
      err.status = 422;
      throw err;
    }
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return JSON.parse(text);
  };
}
