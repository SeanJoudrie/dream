import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTidy,
  corpusOf,
  DAY,
  daysLeft,
  exportFilename,
  exportText,
  forAI,
  listFor,
  mergeState,
  newEntry,
  parseTags,
  purge,
  cutAt,
  polishedEdited,
} from '../public/core.js';

const T = Date.UTC(2026, 8, 22, 4, 12);
const mk = (raw, fields = {}, at = T) => ({ ...newEntry(raw, at), ...fields });

test('corpusOf drops private and trashed dreams', () => {
  const a = mk('a');
  const b = mk('b', { vault: true });
  const c = mk('c', { deletedAt: T });
  assert.deepEqual(corpusOf([a, b, c]), [a]);
  assert.deepEqual(forAI([a, b, c]).map((d) => d.text), ['a']);
});

test('forAI sends only id, date and text', () => {
  const e = mk('a dream', { note: 'secret note', tags: ['x'], title: 't' });
  assert.deepEqual(Object.keys(forAI([e])[0]).sort(), ['date', 'id', 'text']);
});

test('merge: newest updatedAt wins, tombstones stay dead', () => {
  const e = mk('old', { updatedAt: 1 });
  const newer = { ...e, raw: 'new', updatedAt: 2 };
  const gone = mk('gone');
  const merged = mergeState({ entries: [e, gone], dead: [] }, { entries: [newer, gone], dead: [gone.id] });
  assert.equal(merged.entries.length, 1);
  assert.equal(merged.entries[0].raw, 'new');
  assert.deepEqual(merged.dead, [gone.id]);
  // Order of arguments doesn't matter.
  assert.equal(mergeState({ entries: [newer], dead: [] }, { entries: [e], dead: [] }).entries[0].raw, 'new');
});

test('trash purges after 30 days and counts down', () => {
  const fresh = mk('fresh', { deletedAt: T - 8 * DAY });
  const old = mk('old', { deletedAt: T - 30 * DAY });
  assert.equal(daysLeft(fresh, T), 22);
  const s = purge({ entries: [fresh, old], dead: [] }, T);
  assert.deepEqual(s.entries.map((e) => e.raw), ['fresh']);
  assert.deepEqual(s.dead, [old.id]);
});

test('list: private dreams only under Private, never in search', () => {
  const pub = mk('flying over a lake');
  const priv = mk('flying somewhere private', { vault: true });
  const trashed = mk('flying in trash', { deletedAt: T });
  assert.deepEqual(listFor([pub, priv, trashed], { query: 'flying' }), [pub]);
  assert.deepEqual(listFor([pub, priv, trashed], { filter: 'private' }), [priv]);
  assert.deepEqual(listFor([pub, priv, trashed], { filter: 'trash' }), [trashed]);
});

test('search matches tags, notes and titles', () => {
  const e = mk('something', { tags: ['lucid'], note: 'after the party', title: 'Blue door' });
  for (const q of ['lucid', 'party', 'blue door']) assert.equal(listFor([e], { query: q }).length, 1, q);
});

test('parseTags normalises', () => {
  assert.deepEqual(parseTags('Lucid, #flying,, lucid '), ['lucid', 'flying']);
});

test('tidy, one dream: raw is kept, polished and title filled', () => {
  const e = mk('um so i was on a boat and uh my sister was there');
  const [out] = applyTidy(e, { dreams: [{ title: 'Boat with my sister', text: "I'm on a boat. My sister is there.", starts_with: 'um so i was' }] }, T + 5);
  assert.equal(out.raw, e.raw);
  assert.equal(out.polished, "I'm on a boat. My sister is there.");
  assert.equal(out.aiPolished, out.polished);
  assert.equal(out.title, 'Boat with my sister');
  assert.equal(out.updatedAt, T + 5);
  assert.equal(out.source, undefined);
});

test('tidy keeps a hand-edited title', () => {
  const e = mk('a boat', { title: 'Mine' });
  const [out] = applyTidy(e, { dreams: [{ title: 'Theirs', text: 'A boat.', starts_with: 'a boat' }] });
  assert.equal(out.title, 'Mine');
});

test('tidy with no dream in it changes nothing', () => {
  const e = mk('i dont remember anything');
  assert.deepEqual(applyTidy(e, { dreams: [] }), [e]);
});

const TWO = 'i was at school and the halls were flooded then i had another dream i was on a jet ski with my dad';

test('split: pieces are cut at the start phrases and tile the transcript exactly', () => {
  const e = mk(TWO, { tags: ['vivid'] });
  const out = applyTidy(e, {
    dreams: [
      { title: 'Flooded school', text: "I'm at school. The halls are flooded.", starts_with: 'i was at school and the halls' },
      // Punctuation and case differ from the transcript; still found.
      { title: 'Jet ski with dad', text: "I'm on a jet ski with my dad.", starts_with: 'Then I had another dream, I was on' },
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, e.id);
  assert.notEqual(out[1].id, e.id);
  assert.equal(out[0].raw, 'i was at school and the halls were flooded');
  assert.equal(out[1].raw, 'then i had another dream i was on a jet ski with my dad');
  assert.equal(out.map((p) => p.raw).join(' '), TWO);
  assert.equal(out[0].source, TWO);
  assert.deepEqual(out[1].tags, ['vivid']);
  assert.ok(out[1].createdAt > e.createdAt);
});

test('split: a start phrase that is not in the transcript means no split, nothing lost', () => {
  const e = mk(TWO);
  const out = applyTidy(e, {
    dreams: [
      { title: 'School', text: 'School.', starts_with: 'i was at school' },
      { title: 'Sea', text: 'The sea.', starts_with: 'a dream about the sea' }, // invented
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].raw, TWO);
  assert.match(out[0].polished, /School\.\n\n\* \* \*\n\nThe sea\./);
});

test('split: more than four dreams — the rest are folded into the fourth', () => {
  const raw = 'one a b c two d e f three g h i four j k l five m n o';
  const dreams = ['one', 'two', 'three', 'four', 'five'].map((w) => ({ title: w, text: w.toUpperCase(), starts_with: w }));
  const out = applyTidy(mk(raw), { dreams });
  assert.equal(out.length, 4);
  assert.equal(out[3].raw, 'four j k l five m n o');
  assert.equal(out[3].polished, 'FOUR\n\nFIVE');
});

test('cutAt matches the shorter phrase when the model adds words', () => {
  assert.deepEqual(cutAt('red house then i had another dream about a whale', ['red', 'then i had another dream about the ocean']), [
    'red house',
    'then i had another dream about a whale',
  ]);
});

test('polishedEdited notices hand edits to tidied text', () => {
  assert.equal(polishedEdited(mk('x', { polished: 'X.', aiPolished: 'X.' })), false);
  assert.equal(polishedEdited(mk('x', { polished: 'X!', aiPolished: 'X.' })), true);
  assert.equal(polishedEdited(mk('x')), false);
});

test('export: plain text, private included, trash excluded', () => {
  const a = mk('public raw', { polished: 'Public prose.', tags: ['t1'], note: 'n1' });
  const b = mk('private one', { vault: true }, T + 1);
  const c = mk('trashed', { deletedAt: T }, T + 2);
  const txt = exportText([a, b, c], T);
  assert.match(txt, /Public prose\./);
  assert.match(txt, /Original transcript:\npublic raw/);
  assert.match(txt, /private one/);
  assert.match(txt, /\(private\)/);
  assert.match(txt, /Tags: t1/);
  assert.match(txt, /Note: n1/);
  assert.doesNotMatch(txt, /trashed/);
  assert.match(txt, /Trash is not included\./);
  assert.match(exportFilename(T), /^dreams-\d{4}-\d{2}-\d{2}\.txt$/);
});
