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
    imgPrompt: null,
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

export const FILTERS = ['all', 'fav', 'raw', 'private', 'trash'];

// What the journal list shows. Private dreams appear only under the Private
// filter — not in the main list, not in search.
export function listFor(entries, { filter = 'all', query = '' } = {}) {
  let rows;
  if (filter === 'trash') rows = entries.filter((e) => e.deletedAt);
  else if (filter === 'private') rows = entries.filter((e) => e.vault && !e.deletedAt);
  else {
    rows = entries.filter((e) => !e.vault && !e.deletedAt);
    if (filter === 'fav') rows = rows.filter((e) => e.fav);
    if (filter === 'raw') rows = rows.filter((e) => e.polished == null);
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

const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Did the model hand back slices that are really from the original, and do
// they cover it? If not, we don't trust the slicing with the user's raw text.
export function slicesAreFaithful(original, slices) {
  const whole = norm(original);
  if (!slices.every((s) => norm(s) && whole.includes(norm(s)))) return false;
  const covered = slices.reduce((n, s) => n + wordCount(norm(s)), 0);
  return covered >= 0.9 * wordCount(whole);
}

// Apply a tidy result to an entry. One dream: fill in polished + title.
// Several: the original entry becomes the first dream and the rest become new
// entries alongside it, each with its own slice of the transcript. `raw` is
// never lost — if the slices don't hold up, every piece keeps the full original.
export function applyTidy(entry, result, now = Date.now()) {
  const dreams = (result?.dreams || []).filter((d) => d && String(d.text || '').trim()).slice(0, MAX_SPLIT);
  if (!dreams.length) return [entry];

  if (dreams.length === 1) {
    return [{ ...entry, polished: dreams[0].text.trim(), title: entry.title || cleanTitle(dreams[0].title), updatedAt: now }];
  }

  const faithful = slicesAreFaithful(entry.raw, dreams.map((d) => d.transcript || ''));
  return dreams.map((d, i) => {
    const base =
      i === 0
        ? entry
        : { ...newEntry('', now), createdAt: entry.createdAt + i, tags: [...entry.tags], note: '', vault: entry.vault };
    return {
      ...base,
      raw: faithful ? d.transcript.trim() : entry.raw,
      polished: d.text.trim(),
      title: cleanTitle(d.title) || (i === 0 ? entry.title : null),
      imgPrompt: i === 0 ? entry.imgPrompt : null,
      updatedAt: now,
    };
  });
}

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
  const out = [`Dream journal — exported ${isoDay(now)}`, `${live.length} dream${live.length === 1 ? '' : 's'}`, ''];
  for (const e of live) {
    out.push(rule, formatWhen(e.createdAt) + (e.vault ? '  (private)' : '') + (e.fav ? '  ★' : ''));
    if (e.title) out.push(e.title);
    out.push('', textOf(e).trim());
    if (e.polished) out.push('', 'Original transcript:', e.raw.trim());
    if (e.note?.trim()) out.push('', 'Note: ' + e.note.trim());
    if (e.tags?.length) out.push('', 'Tags: ' + e.tags.join(', '));
    if (e.imgPrompt?.trim()) out.push('', 'Image prompt: ' + e.imgPrompt.trim());
    out.push('');
  }
  return out.join('\n');
}

export const exportFilename = (now = Date.now()) => `dreams-${isoDay(now)}.txt`;

// The shape the Explore tools send: id, date, text. Nothing else leaves.
export function forAI(entries) {
  return corpusOf(entries).map((e) => ({ id: e.id, date: isoDay(e.createdAt), text: textOf(e) }));
}
