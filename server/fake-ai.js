// A stand-in for the model, for working on the UI without an API key
// (DREAM_FAKE_AI=1). It does crude, obviously-mechanical versions of each task
// so every screen can be exercised. Never used when a key is configured.

const sentences = (s) =>
  s
    .replace(/\b(um+|uh+|like,)\s*/gi, '')
    .split(/(?<=[.!?])\s+|\s+(?:and then|then)\s+/i)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x[0].toUpperCase() + x.slice(1).replace(/[.!?]*$/, '.'))
    .join(' ');

const title = (s) => s.split(/\s+/).filter((w) => w.length > 3).slice(0, 4).join(' ');

export async function fakeAI(task, input) {
  await new Promise((r) => setTimeout(r, 400));
  switch (task) {
    case 'tidy': {
      const parts = input.text.split(/(?=\b(?:then i had another dream|and in a different one|in another dream)\b)/i);
      return {
        dreams: parts.slice(0, 4).map((p) => ({
          title: title(p),
          text: sentences(p),
          starts_with: p.trim().split(/\s+/).slice(0, 8).join(' '),
        })),
      };
    }
    case 'repeats': {
      const counts = new Map();
      for (const d of input.dreams)
        for (const w of new Set(d.text.toLowerCase().match(/\b[a-z]{5,}\b/g) || []))
          counts.set(w, (counts.get(w) || 0) + 1);
      const items = [...counts]
        .filter(([, n]) => n > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([thing, count]) => ({ thing, count, examples: [] }));
      return { items };
    }
    case 'who':
      return { people: [{ name: 'someone (fake AI)', count: 1 }], places: [] };
    case 'ask': {
      const words = input.question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matches = input.dreams
        .filter((d) => words.some((w) => d.text.toLowerCase().includes(w)))
        .map((d) => ({ id: d.id, line: d.text.slice(0, 80) }));
      return { matches };
    }
    default:
      throw new Error('unknown task');
  }
}
