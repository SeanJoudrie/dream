import {
  applyTidy,
  corpusOf,
  daysLeft,
  exportFilename,
  exportText,
  forAI,
  formatWhen,
  listFor,
  mergeState,
  newEntry,
  newId,
  parseTags,
  polishedEdited,
  purge,
  sortEntries,
  textOf,
  wordCount,
} from './core.js';

// ─── storage ────────────────────────────────────────────────────────────────
// localStorage is the source of truth (SPEC §5). Every write is synchronous.

const LS = {
  get(k, d) {
    try {
      const v = localStorage.getItem('dj.' + k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('dj.' + k, JSON.stringify(v));
      return true;
    } catch {
      toast("Couldn't save to this device. Storage may be full.");
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem('dj.' + k);
    } catch {}
  },
};

let state = purge({ entries: sortEntries(LS.get('entries', [])), dead: LS.get('dead', []) });
let settings = { sounds: true, localOnly: false, onboarded: false, micPrimed: false, dim: 'dim', ...LS.get('settings', {}) };
let syncKey = LS.get('syncKey', null);
if (!syncKey) LS.set('syncKey', (syncKey = newSyncKey()));
persist();

function newSyncKey() {
  const b = crypto.getRandomValues(new Uint8Array(20));
  return [...b].map((x) => (x % 36).toString(36)).join('') + newId().slice(-8);
}

function persist() {
  const ok = LS.set('entries', state.entries);
  return LS.set('dead', state.dead) && ok;
}

function commit() {
  const ok = persist();
  schedulePush();
  return ok;
}

const saveSettings = () => LS.set('settings', settings);
const DIM_LEVELS = { dim: 0, dimmer: 0.35, darkest: 0.6 };
const find = (id) => state.entries.find((e) => e.id === id);

function upsert(...entries) {
  for (const e of entries) {
    const i = state.entries.findIndex((x) => x.id === e.id);
    if (i === -1) state.entries.push(e);
    else state.entries[i] = e;
  }
  sortEntries(state.entries);
  return commit();
}

function patch(id, fields) {
  const e = find(id);
  if (!e) return;
  upsert({ ...e, ...fields, updatedAt: Date.now() });
}

function forget(id) {
  state.entries = state.entries.filter((e) => e.id !== id);
  state.dead = [...new Set([...state.dead, id])];
  commit();
}

// ─── cloud mirror ───────────────────────────────────────────────────────────
// Fire-and-forget after the local write. Never blocks a save.

let pushTimer;
let syncMissing = false;
function schedulePush() {
  if (settings.localOnly || syncMissing) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1500);
}

async function push() {
  if (settings.localOnly) return;
  try {
    const r = await fetch('/api/sync', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-sync-key': syncKey },
      body: JSON.stringify(state),
    });
    if (r.ok) adopt(await r.json());
  } catch {}
}

async function pull() {
  if (settings.localOnly) return;
  try {
    const r = await fetch('/api/sync', { headers: { 'x-sync-key': syncKey } });
    if ([404, 405, 501].includes(r.status)) {
      syncMissing = true; // static host: no server to sync with
      return;
    }
    if (!r.ok) return;
    adopt(await r.json());
    schedulePush();
  } catch {}
}

function adopt(remote) {
  const merged = purge(mergeState(state, remote));
  const before = JSON.stringify(state);
  if (JSON.stringify(merged) === before) return;
  state = merged;
  persist();
  LS.set('lastSync', Date.now());
  // Don't yank the page out from under someone who's typing in an entry.
  if (route().name !== 'entry' && route().name !== 'capture') render();
}

// ─── sound & haptics ────────────────────────────────────────────────────────
// SPEC §4.1. Placeholder sines until there's real sound design.

let actx;
function tone(freqs, { dur = 0.18, gap = 0.04, gain = 0.05 } = {}) {
  if (!settings.sounds) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    let t = actx.currentTime + 0.01;
    for (const f of freqs) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += dur + gap;
    }
  } catch {}
}

// `always` is for the dropout alert: turning sounds off to spare a sleeping
// partner must not make the one warning that matters silent.
function buzz(pattern, { always = false } = {}) {
  if (!settings.sounds && !always) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

const feedback = {
  started: () => (tone([392, 588]), buzz(18)),
  saved: () => (tone([523], { dur: 0.3 }), buzz(30)),
  savedQuiet: () => (tone([523], { dur: 0.3, gain: 0.025 }), buzz(15)),
  dropped: () => (tone([588, 370], { dur: 0.24, gain: 0.12 }), buzz([40, 70, 40], { always: true })),
  discarded: () => (tone([330], { dur: 0.22 }), buzz(12)),
};

// ─── capture ────────────────────────────────────────────────────────────────

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const WATCHDOG_MS = 900;
const DEAD_AFTER_MS = 2600; // recognizer not alive this long → dropout
const FIRST_START_MS = 10_000; // allowance for a permission prompt on first start
const DEAF_AFTER_MS = 8000; // running but no words at all this long → dropout
const SILENT_SAVE_MS = 45_000; // no new words this long → they fell asleep; save
const STOP_GUARD_MS = 1200; // a stop tap this soon after start is a stray touch

const cap = {
  want: false, // we intend to be recording
  running: false, // the recognizer says it is
  lastAlive: 0,
  armedAt: 0, // when this recording started
  heard: false, // any result since this recording started
  lastHeardAt: 0,
  rec: null,
  finalText: '',
  interim: '',
  startedAt: 0,
  watchdog: 0,
  lock: null,
  dropped: null, // null, or why capture stopped on its own: 'dead' | 'deaf' | 'unsaved'
  blocked: false, // mic refused → typing
};

const BANNERS = {
  dead: 'Voice input stopped on its own. Tap to pick up where you left off.',
  deaf: 'Not hearing anything. Tap to try again.',
  unsaved: "Couldn't save — it's still here. Tap to try again.",
  busy: 'Another app is using the microphone. Tap to try again.',
};

const join = (a, b) => [a, b].map((s) => (s || '').trim()).filter(Boolean).join(' ');

// SPEC §4.4: every result — finalized and interim — hits storage immediately.
function persistDraft() {
  const text = join(cap.finalText, cap.interim);
  if (text) LS.set('draft', { text, startedAt: cap.startedAt });
  else LS.del('draft');
}

function restoreDraft() {
  const d = LS.get('draft', null);
  cap.finalText = d?.text || '';
  cap.interim = '';
  cap.startedAt = d?.startedAt || 0;
}

// Interim words become permanent whenever a recognizer session ends, so a
// restart can never overwrite them.
function keepInterim() {
  if (!cap.interim) return;
  cap.finalText = join(cap.finalText, cap.interim);
  cap.interim = '';
  persistDraft();
}

const typingMode = () => !SR || cap.blocked;

function startRecording() {
  if (typingMode() || cap.want) return;
  const now = Date.now();
  cap.want = true;
  cap.everRan = false;
  cap.dropped = null;
  cap.heard = false;
  cap.armedAt = cap.lastAlive = cap.lastHeardAt = now;
  if (!cap.startedAt) cap.startedAt = now;
  feedback.started();
  lockScreen();
  startRecognizer();
  clearInterval(cap.watchdog);
  cap.watchdog = setInterval(watch, WATCHDOG_MS);
  paintCapture();
}

function startRecognizer() {
  const rec = new SR();
  cap.rec = rec;
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US'; // SPEC §4.8: English only at launch.
  const mine = () => cap.rec === rec;

  rec.onstart = () => {
    if (!mine()) return;
    cap.running = true;
    cap.everRan = true;
    cap.lastAlive = Date.now();
  };
  rec.onend = () => {
    if (!mine()) return;
    cap.running = false;
    cap.lastAlive = Date.now();
    keepInterim();
    // Browsers end sessions on silence. Quietly start a new one; if that
    // doesn't come back, the watchdog calls it a dropout.
    if (cap.want) setTimeout(() => cap.want && !cap.running && mine() && tryStart(), 250);
  };
  rec.onresult = (ev) => {
    if (!mine()) return;
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) cap.finalText = join(cap.finalText, r[0].transcript);
      else interim += r[0].transcript;
    }
    cap.interim = interim.trim();
    cap.heard = true;
    cap.lastHeardAt = Date.now();
    persistDraft();
    paintTranscript();
  };
  rec.onerror = (ev) => {
    if (!mine()) return;
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') micBlocked();
    else if (ev.error === 'audio-capture') dropout('busy');
    else if (ev.error === 'network') dropout('dead');
  };
  tryStart();
}

function tryStart() {
  try {
    cap.rec.start();
  } catch {
    // Already started, or refused; the watchdog decides.
  }
}

// SPEC §4.2. Three ways a recording goes wrong without anyone noticing:
// the recognizer dies, it runs but hears nothing, or the person falls asleep.
function watch() {
  if (!cap.want) return;
  const now = Date.now();
  const limit = cap.everRan ? DEAD_AFTER_MS : FIRST_START_MS;
  if (!cap.running && now - cap.lastAlive > limit) return dropout('dead');
  if (!cap.heard && cap.everRan && now - cap.armedAt > DEAF_AFTER_MS) return dropout('deaf');
  if (cap.heard && now - cap.lastHeardAt > SILENT_SAVE_MS) return stopAndSave({ quiet: true });
}

function haltRecognizer() {
  cap.want = false;
  cap.running = false;
  clearInterval(cap.watchdog);
  const rec = cap.rec;
  cap.rec = null;
  try {
    rec?.abort();
  } catch {}
  releaseScreen();
}

function dropout(why) {
  if (!cap.want) return;
  haltRecognizer();
  keepInterim();
  cap.dropped = why;
  feedback.dropped();
  paintCapture();
}

// Tap again → saved. No confirmation. Ever.
function stopAndSave({ quiet = false } = {}) {
  haltRecognizer();
  saveDraftAsEntry(join(cap.finalText, cap.interim), { quiet });
}

// "Saved" is only said once the dream is actually on disk. If the write fails,
// the draft stays and the user hears the dropout tone instead.
function saveDraftAsEntry(text, { quiet = false } = {}) {
  text = (text || '').trim();
  if (!text) {
    feedback.discarded(); // nothing heard — sounds different from "saved"
    return resetCapture();
  }
  const e = newEntry(text, cap.startedAt || Date.now());
  e.updatedAt = Date.now();
  const written = upsert(e) && LS.get('entries', []).some((x) => x.id === e.id);
  if (!written) {
    state.entries = state.entries.filter((x) => x.id !== e.id);
    cap.finalText = text;
    cap.interim = '';
    persistDraft();
    cap.dropped = 'unsaved';
    feedback.dropped();
    return paintCapture();
  }
  quiet ? feedback.savedQuiet() : feedback.saved();
  LS.set('lastSaved', e.createdAt);
  resetCapture();
}

function discard() {
  haltRecognizer();
  feedback.discarded();
  resetCapture();
}

function resetCapture() {
  LS.del('draft');
  cap.finalText = '';
  cap.interim = '';
  cap.startedAt = 0;
  cap.dropped = null;
  disarm($('#cancel'));
  paintCapture();
}

function micBlocked() {
  haltRecognizer();
  cap.blocked = true;
  keepInterim();
  persistDraft();
  paintCapture();
}

async function lockScreen() {
  try {
    cap.lock = await navigator.wakeLock?.request('screen');
  } catch {}
}

function releaseScreen() {
  try {
    cap.lock?.release();
  } catch {}
  cap.lock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (cap.want) lockScreen();
  pull();
});

function onStageTap() {
  if (typingMode()) return;
  if (!cap.want) return startRecording();
  if (Date.now() - cap.armedAt < STOP_GUARD_MS) return; // double-tap or a stray touch
  stopAndSave();
}

function paintCapture() {
  const el = $('#capture');
  const recording = cap.want;
  const hasText = !!join(cap.finalText, cap.interim);
  el.dataset.state = typingMode() ? 'typing' : recording ? 'recording' : hasText ? 'draft' : 'idle';
  $('#cancel').hidden = !recording;
  $('#to-journal').hidden = recording;
  $('#stage').hidden = typingMode();
  $('#stage').setAttribute('aria-pressed', String(recording));
  $('#typing').hidden = !typingMode();
  $('#idle-copy').hidden = recording || hasText;
  $('#draft-note').hidden = recording || !hasText || !!cap.dropped;
  $('#banner').hidden = !cap.dropped;
  $('#banner').textContent = BANNERS[cap.dropped] || '';
  const last = LS.get('lastSaved', 0);
  $('#last-saved').hidden = recording || hasText || !last || Date.now() - last > 12 * 3600_000;
  $('#last-saved').textContent = last ? `Saved · ${formatWhen(last).split(' · ')[1]}` : '';
  $('#live').textContent = recording ? 'Recording' : cap.dropped ? BANNERS[cap.dropped] : '';
  if (typingMode()) {
    const box = $('#type-box');
    if (!box.value && hasText) box.value = join(cap.finalText, cap.interim);
    $('#type-why').textContent = !SR
      ? "This browser can't turn speech into text, so type it instead."
      : 'The microphone is off for this app. Allow it in your browser settings to talk instead.';
    $('#retry-voice').hidden = !SR;
  }
  paintTranscript();
}

function paintTranscript() {
  $('#final').textContent = cap.finalText;
  $('#interim').textContent = cap.interim;
  const t = $('#transcript');
  t.scrollTop = t.scrollHeight; // always show the newest words
  t.classList.toggle('overflow', t.scrollHeight > t.clientHeight + 1);
}

// ─── two-tap confirm ────────────────────────────────────────────────────────
// SPEC §4.5 and §13: never "Are you sure?" — the button asks, then acts.

function armable(btn, onConfirm) {
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (btn.dataset.armed) {
      disarm(btn);
      onConfirm();
      return;
    }
    arm(btn);
  });
}

function arm(btn) {
  btn.dataset.armed = '1';
  btn.dataset.label = btn.textContent;
  btn.textContent = btn.dataset.confirm;
  btn.classList.add('armed');
  btn._t = setTimeout(() => disarm(btn), 4000);
}

function disarm(btn) {
  if (!btn?.dataset.armed) return;
  clearTimeout(btn._t);
  delete btn.dataset.armed;
  btn.textContent = btn.dataset.label;
  btn.classList.remove('armed');
}

// ─── AI ─────────────────────────────────────────────────────────────────────
// One door out. Everything that reaches the model passes corpusOf() here.

class AIError extends Error {}

async function ai(task, sources, input) {
  if (settings.localOnly) throw new AIError('Local-only mode is on.');
  if (corpusOf(sources).length !== sources.length) throw new AIError('Private dreams never go to the AI.');
  let r;
  try {
    r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task, input }),
    });
  } catch {
    throw new AIError("Couldn't reach the server. Nothing was changed.");
  }
  if (r.status === 503) throw new AIError("The AI isn't set up on this server.");
  // A static host (the GitHub Pages demo) has no /api at all.
  if ([404, 405, 501].includes(r.status)) throw new AIError("Tidying isn't available in this demo.");
  if (r.status === 422) throw new AIError("The AI declined that one. Nothing was changed.");
  if (!r.ok) throw new AIError("That didn't work. Nothing was changed — try again in a bit.");
  return r.json();
}

// ─── routing ────────────────────────────────────────────────────────────────

function route() {
  const [, name = '', id] = location.hash.split('/');
  return { name: name || 'capture', id };
}

window.addEventListener('hashchange', render);

function render() {
  const r = route();
  const onCapture = r.name === 'capture';
  // Leaving the capture screen never leaves a hot mic behind it.
  if (!onCapture && cap.want) stopAndSave();
  // Capture-screen dimming (a setting) applies only to the capture screen.
  $('#dim').style.opacity = onCapture ? DIM_LEVELS[settings.dim] ?? 0 : 0;
  $('#capture').hidden = !onCapture;
  $('#page').hidden = onCapture;
  document.querySelector('meta[name=theme-color]').content = onCapture ? '#0a0912' : '#131120';
  if (onCapture) return paintCapture();
  const view = { journal: renderJournal, entry: renderEntry, explore: renderExplore, settings: renderSettings }[r.name];
  if (!view) return (location.hash = '#/');
  view(r.id);
  $('#page').scrollTop = 0;
}

// ─── journal ────────────────────────────────────────────────────────────────

const journalView = { filter: 'all', query: '' };
const FILTER_LABELS = { all: 'All', fav: 'Favorites', private: 'Private', trash: 'Trash' };

function pageHead(back, backLabel, extra = '') {
  return `<header class="bar"><a class="link" href="${back}">${backLabel}</a><nav class="bar-right">${extra}</nav></header>`;
}

function renderJournal() {
  $('#page').innerHTML = `
    ${pageHead('#/', '← Record', `<a class="link" href="#/explore">Explore</a><a class="link" href="#/settings">Settings</a>`)}
    <div class="wrap">
      <h1>Journal</h1>
      <input id="search" type="search" placeholder="Search your dreams" value="${esc(journalView.query)}" autocomplete="off">
      <div class="pills" role="tablist">
        ${Object.entries(FILTER_LABELS)
          .map(([k, v]) => `<button type="button" role="tab" class="pill" data-filter="${k}" aria-selected="${journalView.filter === k}">${v}</button>`)
          .join('')}
      </div>
      <ol id="rows" class="rows"></ol>
      <div class="ad-slot" data-ad-slot="journal-bottom" hidden></div>
    </div>`;
  $('#search').addEventListener('input', (e) => {
    journalView.query = e.target.value;
    paintRows();
  });
  $('#page .pills').addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]')?.dataset.filter;
    if (!f) return;
    journalView.filter = f;
    $$('#page .pill').forEach((p) => p.setAttribute('aria-selected', p.dataset.filter === f));
    paintRows();
  });
  paintRows();
}

const EMPTY = {
  all: 'Nothing yet. The next dream you tell it goes here.',
  fav: 'No favorites yet. Star a dream from its page.',
  private: 'Nothing private. Any dream can be moved here from its page.',
  trash: 'Trash is empty. Deleted dreams wait here for 30 days.',
};

function paintRows() {
  const rows = listFor(state.entries, journalView);
  const ol = $('#rows');
  if (!rows.length) {
    ol.innerHTML = `<li class="empty">${journalView.query ? 'No dreams match that.' : EMPTY[journalView.filter]}</li>`;
    return;
  }
  const now = Date.now();
  ol.innerHTML = rows
    .map((e) => {
      const text = textOf(e);
      const dots = [
        e.vault ? '<span class="dot-tag">private</span>' : '',
        e.deletedAt ? `<span class="dot-tag">${daysLeft(e, now)}d left</span>` : '',
      ].join('');
      return `<li><a href="#/entry/${e.id}">
        <div class="meta"><time>${formatWhen(e.createdAt)}</time>${e.fav ? '<span class="star" aria-label="favorite">★</span>' : ''}${dots}</div>
        <h2>${esc(e.title || firstWords(text))}</h2>
        <p class="preview">${esc(text)}</p>
        ${e.tags.length ? `<p class="tags">${e.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
      </a></li>`;
    })
    .join('');
}

const firstWords = (s) => s.split(/\s+/).slice(0, 7).join(' ') + (wordCount(s) > 7 ? '…' : '');

// ─── entry ──────────────────────────────────────────────────────────────────

function renderEntry(id) {
  const e = find(id);
  if (!e) return (location.hash = '#/journal');
  const aiOk = !settings.localOnly && !e.vault && !e.deletedAt;
  const now = Date.now();

  $('#page').innerHTML = `
    ${pageHead('#/journal', '← Journal')}
    <article class="wrap entry">
      ${
        e.deletedAt
          ? `<div class="trash-bar"><span>In trash · ${daysLeft(e, now)}d left</span>
             <span><button type="button" class="quiet" id="restore">Restore</button>
             <button type="button" class="quiet danger" id="forever" data-confirm="delete it for good?">Delete forever</button></span></div>`
          : ''
      }
      <time class="when">${formatWhen(e.createdAt)}</time>
      <input id="title" class="title" value="${esc(e.title || '')}" placeholder="Untitled" aria-label="Title">
      <textarea id="text" class="dream" aria-label="Dream">${esc(textOf(e))}</textarea>

      <div class="actions">
        ${aiOk ? `<button type="button" class="quiet" id="tidy" data-confirm="replace your edits?">${e.polished ? 'Tidy again' : 'Tidy up the transcript'}</button>` : ''}
        <button type="button" class="quiet" id="fav" aria-pressed="${e.fav}">${e.fav ? '★ Favorite' : '☆ Favorite'}</button>
      </div>

      ${
        e.polished != null
          ? `<details class="orig"><summary>Original transcript</summary>
             <p class="hint">Both are yours to edit. Fix a misheard word here, then tidy again.</p>
             <textarea id="raw" aria-label="Original transcript">${esc(e.raw)}</textarea></details>`
          : ''
      }
      ${
        e.source && e.source !== e.raw
          ? `<details class="orig"><summary>Everything you said, before it was split</summary>
             <p class="source">${esc(e.source)}</p></details>`
          : ''
      }

      <label class="field"><span>Tags</span>
        <input id="tags" value="${esc(e.tags.join(', '))}" placeholder="lucid, flying" autocomplete="off"></label>
      <label class="field"><span>Note</span>
        <textarea id="note" placeholder="Anything about that day, in your own words.">${esc(e.note)}</textarea></label>

      <label class="toggle"><input type="checkbox" id="vault" ${e.vault ? 'checked' : ''}>
        <span>Private<small>Hidden from the list and from search. Never sent to any AI.</small></span></label>

      ${e.deletedAt ? '' : '<button type="button" class="quiet danger" id="delete">Delete</button>'}
    </article>`;

  grow($('#text'));
  grow($('#raw'));
  grow($('#note'));

  const save = debounce((fields) => patch(id, fields), 350);
  on('#title', 'input', (ev) => save({ title: ev.target.value.trim() || null }));
  on('#text', 'input', (ev) => {
    grow(ev.target);
    save(find(id).polished != null ? { polished: ev.target.value } : { raw: ev.target.value });
  });
  on('#raw', 'input', (ev) => (grow(ev.target), save({ raw: ev.target.value })));
  on('#tags', 'change', (ev) => {
    const tags = parseTags(ev.target.value);
    ev.target.value = tags.join(', ');
    patch(id, { tags });
  });
  on('#note', 'input', (ev) => (grow(ev.target), save({ note: ev.target.value })));

  on('#fav', 'click', () => {
    save.flush();
    patch(id, { fav: !find(id).fav });
    renderEntry(id);
  });
  on('#vault', 'change', (ev) => {
    save.flush();
    patch(id, { vault: ev.target.checked });
    renderEntry(id);
  });
  on('#delete', 'click', () => {
    save.flush();
    patch(id, { deletedAt: Date.now() });
    toast('Moved to trash. It stays there for 30 days.');
    location.hash = '#/journal';
  });
  on('#restore', 'click', () => {
    patch(id, { deletedAt: null });
    renderEntry(id);
  });
  const forever = $('#forever');
  if (forever) armable(forever, () => (forget(id), (location.hash = '#/journal')));

  // Tidy always works from the transcript. If the tidied text has been
  // edited by hand since, it asks once before replacing those edits.
  const tidyBtn = $('#tidy');
  tidyBtn?.addEventListener('click', async () => {
    save.flush();
    const entry = find(id);
    if (polishedEdited(entry) && !tidyBtn.dataset.armed) return arm(tidyBtn);
    disarm(tidyBtn);
    $('#text').readOnly = true; // nothing typed now can be overwritten by the result
    try {
      await busy(tidyBtn, 'Tidying…', async () => {
        const result = await ai('tidy', [entry], { text: entry.raw });
        if (!result?.dreams?.length) return toast("Didn't find a dream in there to tidy.");
        const pieces = applyTidy(find(id), result, Date.now());
        upsert(...pieces);
        if (pieces.length > 1) toast(`Heard ${pieces.length} separate dreams — split them out`);
        renderEntry(id);
      });
    } finally {
      if ($('#text')) $('#text').readOnly = false;
    }
  });

  window.onbeforeunload = () => save.flush();
}

// ─── explore ────────────────────────────────────────────────────────────────

const TOOLS = [
  { key: 'repeats', name: 'Repeats', min: 4, verb: 'Count', blurb: 'Concrete things that show up in more than one dream, counted.' },
  { key: 'who', name: 'Who and where', min: 3, verb: 'Make the index', blurb: 'The people and places in your dreams, and how often.' },
  { key: 'ask', name: 'Ask your journal', min: 1, blurb: 'Find dreams by describing them. “Dreams where I was late.”' },
];

const exploreResults = {};

function renderExplore() {
  const corpus = corpusOf(state.entries);
  const privateCount = state.entries.filter((e) => e.vault && !e.deletedAt).length;

  $('#page').innerHTML = `
    ${pageHead('#/journal', '← Journal')}
    <div class="wrap">
      <h1>Explore</h1>
      ${
        settings.localOnly
          ? '<p class="lede">Local-only mode is on, so nothing here runs. Everything stays on this device.</p>'
          : `<p class="lede">We count and we find. We don't tell you what any of it means.${
              privateCount ? ` Your ${privateCount} private dream${privateCount > 1 ? 's are' : ' is'} left out.` : ''
            }</p>`
      }
      <div class="tools">
        ${TOOLS.map((t) => {
          const have = corpus.length;
          const short = have < t.min;
          return `<section class="tool" data-tool="${t.key}">
            <h2>${t.name}</h2>
            <p class="hint">${t.blurb}</p>
            ${
              settings.localOnly
                ? ''
                : short
                  ? `<p class="hint">Needs at least ${t.min} dream${t.min > 1 ? 's' : ''}. You have ${have}. That's normal early on.</p>`
                  : t.key === 'ask'
                    ? `<form class="ask-form"><input name="q" placeholder="Dreams where I was late" autocomplete="off"><button class="quiet">Find</button></form>`
                    : `<button type="button" class="quiet run">${t.verb}${exploreResults[t.key] ? ' again' : ''}</button>`
            }
            <div class="result">${exploreResults[t.key] || ''}</div>
          </section>`;
        }).join('')}
      </div>
    </div>`;

  $$('#page .run').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const key = btn.closest('[data-tool]').dataset.tool;
      await runTool(key, btn, corpus);
    }),
  );
  $('#page .ask-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const q = ev.target.q.value.trim();
    if (q) await runTool('ask', ev.target.querySelector('button'), corpus, q);
  });
}

async function runTool(key, btn, sources, question) {
  await busy(btn, key === 'ask' ? 'Looking…' : 'Counting…', async () => {
    const input = { dreams: forAI(sources), ...(question ? { question } : {}) };
    const out = await ai(key, sources, input);
    exploreResults[key] = showResult(key, out, sources, question);
    const box = $(`[data-tool="${key}"] .result`);
    if (box) box.innerHTML = exploreResults[key];
  });
}

function showResult(key, out, sources, question) {
  const COUNTED = '<p class="footer">Just things we counted. Make of them what you want.</p>';
  if (key === 'repeats') {
    const items = (out.items || []).filter((i) => i.count >= 2);
    if (!items.length) return `<p>Nothing repeats yet. We'd rather say so than make something up.</p>`;
    return (
      `<ul class="plain">${items
        .map((i) => `<li><em>${esc(cap1(i.thing))}</em> shows up in ${i.count}${i.examples?.length ? ' — ' + i.examples.map(esc).join(', ') : ''}.</li>`)
        .join('')}</ul>` + COUNTED
    );
  }
  if (key === 'who') {
    const col = (title, rows) =>
      `<div><h3>${title}</h3>${
        rows?.length ? `<ul class="plain">${rows.map((r) => `<li>${esc(r.name)} <span class="n">${r.count}</span></li>`).join('')}</ul>` : '<p class="hint">None named yet.</p>'
      }</div>`;
    return `<div class="cols">${col('People', out.people)}${col('Places', out.places)}</div>` + COUNTED;
  }
  if (key === 'ask') {
    // Only ever link to dreams that were actually sent.
    const ok = new Map(sources.map((e) => [e.id, e]));
    const hits = (out.matches || []).filter((m) => ok.has(m.id));
    if (!hits.length) return `<p>No dreams matched “${esc(question)}”.</p>`;
    return `<ul class="plain hits">${hits
      .map((m) => {
        const e = ok.get(m.id);
        return `<li><a href="#/entry/${e.id}"><time>${formatWhen(e.createdAt)}</time> ${esc(e.title || firstWords(textOf(e)))}</a><span class="hint">${esc(m.line)}</span></li>`;
      })
      .join('')}</ul>`;
  }
  return '';
}

// ─── settings ───────────────────────────────────────────────────────────────

function renderSettings() {
  const last = LS.get('lastSync', 0);
  $('#page').innerHTML = `
    ${pageHead('#/journal', '← Journal')}
    <div class="wrap settings">
      <h1>Settings</h1>

      <label class="toggle"><input type="checkbox" id="s-sounds" ${settings.sounds ? 'checked' : ''}>
        <span>Sounds<small>Soft tones and a buzz when recording starts, saves, or drops out, so you don't have to look.</small></span></label>

      <fieldset class="choice" id="s-dim">
        <legend>Capture screen brightness</legend>
        ${[['dim', 'Dim'], ['dimmer', 'Dimmer'], ['darkest', 'Darkest']]
          .map(([v, l]) => `<label><input type="radio" name="dim" value="${v}" ${settings.dim === v ? 'checked' : ''}> ${l}</label>`)
          .join('')}
      </fieldset>

      <label class="toggle"><input type="checkbox" id="s-local" ${settings.localOnly ? 'checked' : ''}>
        <span>Keep everything on this device<small>Keeps everything on this device. No tidying, no patterns, no image prompts, no sync. The journal still works exactly the same.</small></span></label>

      <section>
        <h2>Passcode</h2>
        <p class="hint">We don't do a passcode. Your phone already does it better: hold the app icon and pick Require Face ID.</p>
      </section>

      <section>
        <h2>Language</h2>
        <p class="hint">Voice input understands English for now. Other languages are a real project, and we haven't done it yet.</p>
      </section>

      ${
        settings.localOnly || syncMissing
          ? ''
          : `<section>
        <h2>Sync</h2>
        <p class="hint">Enter this code on another device to share one journal between them. Anyone with the code can read your journal, so keep it to yourself.</p>
        <div class="row"><code id="key" class="key">${esc(syncKey)}</code><button type="button" class="quiet" id="copy-key">Copy</button></div>
        <form id="join" class="row"><input name="k" placeholder="Code from your other device" autocomplete="off" spellcheck="false"><button class="quiet">Join</button></form>
        <p class="hint">${last ? 'Last synced ' + formatWhen(last) + '.' : 'Not synced yet.'}</p>
      </section>`
      }

      <section>
        <h2>Export</h2>
        <p class="hint">Every dream as plain text, with transcripts, notes and tags. Private dreams too — it's your file.</p>
        <button type="button" class="quiet" id="export">Download .txt</button>
      </section>

      <section>
        <h2>Erase everything</h2>
        <p class="hint">Erasing wipes this device and your synced copy. There's no account and nothing posted anywhere, so that's all of it.</p>
        <button type="button" class="quiet danger" id="erase" data-confirm="erase it all?">Erase everything</button>
      </section>

      <p class="colophon">This is a dream journal. That's all it is.</p>
    </div>`;

  on('#s-sounds', 'change', (ev) => {
    settings.sounds = ev.target.checked;
    saveSettings();
    if (settings.sounds) feedback.saved();
  });
  on('#s-dim', 'change', (ev) => {
    settings.dim = ev.target.value;
    saveSettings();
  });
  on('#s-local', 'change', (ev) => {
    settings.localOnly = ev.target.checked;
    saveSettings();
    if (!settings.localOnly) pull();
    renderSettings();
  });
  on('#copy-key', 'click', async () => {
    try {
      await navigator.clipboard.writeText(syncKey);
      toast('Copied.');
    } catch {}
  });
  on('#join', 'submit', async (ev) => {
    ev.preventDefault();
    const k = ev.target.k.value.trim().toLowerCase();
    if (!/^[a-z0-9]{24,64}$/.test(k)) return toast("That doesn't look like a sync code.");
    syncKey = k;
    LS.set('syncKey', k);
    await pull();
    await push();
    toast('Joined. Your dreams here are part of that journal now.');
    renderSettings();
  });
  on('#export', 'click', () => {
    const now = Date.now();
    const blob = new Blob([exportText(state.entries, now)], { type: 'text/plain;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: exportFilename(now) });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  armable($('#erase'), async () => {
    clearTimeout(pushTimer);
    state = { entries: [], dead: [] };
    persist();
    LS.del('draft');
    resetCapture();
    try {
      await fetch('/api/sync', { method: 'DELETE', headers: { 'x-sync-key': syncKey } });
    } catch {}
    syncKey = newSyncKey();
    LS.set('syncKey', syncKey);
    LS.del('lastSync');
    toast('Erased.');
    renderSettings();
  });
}

// ─── onboarding ─────────────────────────────────────────────────────────────

function onboarding() {
  const box = $('#onboarding');
  const screens = [
    {
      h: "This is a dream journal. That's all it is.",
      p: 'When you wake up from a dream, roll over, tap anywhere on the screen and talk. Tap again and it’s saved. No typing, no menus.',
    },
    {
      h: 'Any detail counts, no matter how small.',
      p: 'A colour, a room, one face. Fragments are fine — you can clean it up later, in daylight.',
    },
    SR
      ? {
          h: 'One thing first.',
          p: "We need microphone access, and asking at 4am is the worst possible time. Let's get it out of the way now.",
          mic: true,
        }
      : {
          h: 'This browser can’t listen.',
          p: 'It can’t turn speech into text, so you’ll type instead. Voice works in Chrome, Edge and Safari.',
        },
  ];
  let i = 0;
  const done = () => {
    settings.onboarded = true;
    saveSettings();
    box.hidden = true;
    render();
  };
  const paint = () => {
    const s = screens[i];
    box.innerHTML = `<div class="ob">
      <p class="step">${i + 1} / ${screens.length}</p>
      <h1>${s.h}</h1>
      <p>${s.p}</p>
      <div class="ob-actions">
        ${
          s.mic
            ? '<button type="button" class="solid" id="ob-mic">Allow microphone</button><button type="button" class="link" id="ob-later">Later</button>'
            : `<button type="button" class="solid" id="ob-next">${i === screens.length - 1 ? 'Got it' : 'Next'}</button>`
        }
      </div></div>`;
    on('#ob-next', 'click', () => (i < screens.length - 1 ? (i++, paint()) : done()));
    on('#ob-later', 'click', done);
    on('#ob-mic', 'click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        settings.micPrimed = true;
      } catch (e) {
        // Refused → typing. Anything else (no device yet, etc.) we'll retry at record time.
        if (e?.name === 'NotAllowedError') cap.blocked = true;
      }
      done();
    });
  };
  box.hidden = false;
  paint();
}

// ─── helpers ────────────────────────────────────────────────────────────────

function $(s, root = document) {
  return root.querySelector(s);
}
function $$(s, root = document) {
  return [...root.querySelectorAll(s)];
}
function on(sel, type, fn) {
  $(sel)?.addEventListener(type, fn);
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const cap1 = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

function grow(ta) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 2 + 'px';
}

function debounce(fn, ms) {
  let t, last;
  const d = (arg) => {
    last = arg;
    clearTimeout(t);
    t = setTimeout(() => ((t = 0), fn(last)), ms);
  };
  d.flush = () => {
    if (!t) return;
    clearTimeout(t);
    t = 0;
    fn(last);
  };
  return d;
}

async function busy(btn, label, work) {
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try {
    await work();
  } catch (e) {
    toast(e instanceof AIError ? e.message : "That didn't work. Nothing was changed.");
    if (!(e instanceof AIError)) console.error(e);
  } finally {
    if (btn.isConnected) {
      btn.disabled = false;
      btn.textContent = was;
    }
  }
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 3200);
}

// ─── boot ───────────────────────────────────────────────────────────────────

function boot() {

  // Anywhere on the capture screen that isn't a control records.
  $('#capture').addEventListener('click', (e) => {
    if (!e.target.closest('.bar, #typing')) onStageTap();
  });
  $('#stage').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onStageTap();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || route().name !== 'capture' || !$('#onboarding').hidden) return;
    if (e.target.closest?.('input, textarea, button, a')) return;
    e.preventDefault();
    onStageTap();
  });
  armable($('#cancel'), discard);

  $('#typing').addEventListener('submit', (e) => {
    e.preventDefault();
    const box = $('#type-box');
    const text = box.value;
    box.value = '';
    saveDraftAsEntry(text);
  });
  $('#retry-voice').addEventListener('click', () => {
    cap.blocked = false;
    cap.finalText = $('#type-box').value;
    $('#type-box').value = '';
    persistDraft();
    startRecording();
  });
  $('#type-box').addEventListener('input', (e) => {
    cap.finalText = e.target.value;
    if (!cap.startedAt) cap.startedAt = Date.now();
    persistDraft();
  });

  restoreDraft();

  // If the browser already knows the mic is refused, go straight to typing.
  navigator.permissions
    ?.query({ name: 'microphone' })
    .then((p) => {
      const sync = () => {
        cap.blocked = p.state === 'denied';
        if (route().name === 'capture') paintCapture();
      };
      sync();
      p.onchange = sync;
    })
    .catch(() => {});

  render();
  if (!settings.onboarded) onboarding();
  pull();
  window.addEventListener('online', pull);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
