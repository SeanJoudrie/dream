// Pure journal logic. No DOM, no storage, no network — shared by the browser app,
// the server (sync merge) and the tests.

export const DAY = 86_400_000;
export const TRASH_DAYS = 30;
export const MAX_SPLIT = 4;

export function newId(now = Date.now()) {
  return now.toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newEntry(raw, now = Date.now()) {
  return {
    id: newId(now),
    createdAt: now,
    updatedAt: now,
    raw,
    polished: null,
    title: null,
    note: '',
    tags: [],
    fav: false,
    vault: false,
    deletedAt: null,
  };
}

export const textOf = (e) => (e.polished != null && e.polished !== '' ? e.polished : e.raw) || '';

export const wordCount = (s) => (String(s).trim().match(/\S+/g) || []).length;

// SPEC §9.2: the whole privacy guarantee. Nothing reaches an AI call unless it
// has passed through here. Private and trashed dreams never do.
export function corpusOf(entries) {
  return entries.filter((e) => e && !e.vault && !e.deletedAt);
}

// Merge two copies of the journal: newest updatedAt wins per entry, and
// anything in either tombstone list stays dead.
export function mergeState(a, b) {
  const dead = [...new Set([...(a?.dead || []), ...(b?.dead || [])])];
  const gone = new Set(dead);
  const byId = new Map();
  for (const e of [...(a?.entries || []), ...(b?.entries || [])]) {
    if (!e || !e.id || gone.has(e.id)) continue;
    const have = byId.get(e.id);
    if (!have || (e.updatedAt || 0) > (have.updatedAt || 0)) byId.set(e.id, e);
  }
  return { entries: sortEntries([...byId.values()]), dead };
}

export const sortEntries = (entries) => entries.sort((x, y) => y.createdAt - x.createdAt);

export function daysLeft(e, now = Date.now()) {
  if (!e.deletedAt) return null;
  return Math.max(0, Math.ceil((e.deletedAt + TRASH_DAYS * DAY - now) / DAY));
}

// Trash older than 30 days is purged for good and tombstoned.
export function purge(state, now = Date.now()) {
  const expired = state.entries.filter((e) => e.deletedAt && now - e.deletedAt >= TRASH_DAYS * DAY);
  if (!expired.length) return state;
  const ids = new Set(expired.map((e) => e.id));
  return {
    entries: state.entries.filter((e) => !ids.has(e.id)),
    dead: [...new Set([...state.dead, ...ids])],
  };
}

export const FILTERS = ['all', 'fav', 'private', 'trash'];

// What the journal list shows. Private dreams appear only under the Private
// filter — not in the main list, not in search.
export function listFor(entries, { filter = 'all', query = '' } = {}) {
  let rows;
  if (filter === 'trash') rows = entries.filter((e) => e.deletedAt);
  else if (filter === 'private') rows = entries.filter((e) => e.vault && !e.deletedAt);
  else {
    rows = entries.filter((e) => !e.vault && !e.deletedAt);
    if (filter === 'fav') rows = rows.filter((e) => e.fav);
  }
  const q = query.trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/);
    rows = rows.filter((e) => {
      const hay = [e.title, e.raw, e.polished, e.note, ...(e.tags || [])].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  return rows;
}

export function parseTags(s) {
  return [
    ...new Set(
      String(s)
        .split(/[,\n]/)
        .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean),
    ),
  ];
}

const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// The transcript as words, each with where it starts in the original text.
function wordsOf(text) {
  return [...String(text).matchAll(/\S+/g)].map((m) => ({ w: norm(m[0]), at: m.index })).filter((x) => x.w);
}

// Where does `phrase` begin in `words`, searching from word `from`? Tries the
// whole phrase, then its first four words. Returns -1 if it isn't there.
function findPhrase(words, phrase, from) {
  const want = wordsOf(phrase).map((x) => x.w);
  for (const n of [want.length, Math.min(4, want.length)]) {
    if (!n) continue;
    for (let i = from; i + n <= words.length; i++) {
      let hit = true;
      for (let j = 0; j < n && hit; j++) hit = words[i + j].w === want[j];
      if (hit) return i;
    }
  }
  return -1;
}

// Cut the transcript where each dream starts. The pieces tile the original
// exactly — every word lands in one piece — or we return null and don't split.
export function cutAt(text, startPhrases) {
  const words = wordsOf(text);
  const starts = [0];
  for (const phrase of startPhrases.slice(1)) {
    const i = findPhrase(words, phrase, starts.at(-1) + 1);
    if (i === -1) return null;
    starts.push(i);
  }
  return starts.map((w, k) => {
    const from = words[w]?.at ?? text.length;
    const to = k + 1 < starts.length ? words[starts[k + 1]].at : text.length;
    return text.slice(from, to).trim();
  });
}

// Apply a tidy result to an entry. One dream: fill in polished + title.
// Several: the original entry becomes the first dream and the rest become new
// entries beside it, each with its own exact piece of the transcript. The full
// transcript as spoken is kept, untouched, in `source` on the first piece.
// If the pieces can't be found, nothing is split: one entry, dreams joined.
export function applyTidy(entry, result, now = Date.now()) {
  let dreams = (result?.dreams || []).filter((d) => d && String(d.text || '').trim());
  if (!dreams.length) return [entry];
  if (dreams.length > MAX_SPLIT) {
    const rest = dreams.slice(MAX_SPLIT - 1);
    dreams = [...dreams.slice(0, MAX_SPLIT - 1), { ...rest[0], text: rest.map((d) => d.text.trim()).join('\n\n') }];
  }

  const one = (polished, title) => {
    polished = polished.trim();
    return [{ ...entry, polished, aiPolished: polished, title: entry.title || cleanTitle(title), updatedAt: now }];
  };
  if (dreams.length === 1) return one(dreams[0].text, dreams[0].title);

  const pieces = cutAt(entry.raw, dreams.map((d) => d.starts_with || ''));
  if (!pieces || pieces.some((p) => !p)) return one(dreams.map((d) => d.text.trim()).join('\n\n* * *\n\n'), dreams[0].title);

  return dreams.map((d, i) => {
    const base =
      i === 0
        ? { ...entry, source: entry.source ?? entry.raw }
        : { ...newEntry('', now), createdAt: entry.createdAt + i, tags: [...entry.tags], vault: entry.vault };
    const polished = d.text.trim();
    return {
      ...base,
      raw: pieces[i],
      polished,
      aiPolished: polished,
      title: cleanTitle(d.title) || (i === 0 ? entry.title : null),
      updatedAt: now,
    };
  });
}

// Has the user edited the tidied text since the AI last wrote it?
export const polishedEdited = (e) => e.polished != null && e.aiPolished != null && e.polished !== e.aiPolished;

const cleanTitle = (t) => String(t || '').trim().replace(/^["'“]|["'”.]$/g, '') || null;

export function formatWhen(ms) {
  const d = new Date(ms);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return `${day} · ${h}:${m}${ap}`;
}

export const isoDay = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// SPEC §10: plain text, everything, private dreams included. It's your file.
export function exportText(entries, now = Date.now()) {
  const live = sortEntries(entries.filter((e) => !e.deletedAt).slice());
  const rule = '─'.repeat(40);
  const out = [
    `Dream journal — exported ${isoDay(now)}`,
    `${live.length} dream${live.length === 1 ? '' : 's'}. Trash is not included.`,
    '',
  ];
  for (const e of live) {
    out.push(rule, formatWhen(e.createdAt) + (e.vault ? '  (private)' : '') + (e.fav ? '  ★' : ''));
    if (e.title) out.push(e.title);
    out.push('', textOf(e).trim());
    if (e.polished) out.push('', 'Original transcript:', e.raw.trim());
    if (e.source && e.source !== e.raw) out.push('', 'Everything said that time, before it was split:', e.source.trim());
    if (e.note?.trim()) out.push('', 'Note: ' + e.note.trim());
    if (e.tags?.length) out.push('', 'Tags: ' + e.tags.join(', '));
    out.push('');
  }
  return out.join('\n');
}

export const exportFilename = (now = Date.now()) => `dreams-${isoDay(now)}.txt`;

// The shape the Explore tools send: id, date, text. Nothing else leaves.
export function forAI(entries) {
  return corpusOf(entries).map((e) => ({ id: e.id, date: isoDay(e.createdAt), text: textOf(e) }));
}
