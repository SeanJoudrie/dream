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
  slicesAreFaithful,
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
  assert.deepEqual(listFor([pub, mk('x', { polished: 'X.' })], { filter: 'raw' }), [pub]);
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
  const [out] = applyTidy(e, { dreams: [{ title: 'Boat with my sister', text: "I'm on a boat. My sister is there.", transcript: e.raw }] }, T + 5);
  assert.equal(out.raw, e.raw);
  assert.equal(out.polished, "I'm on a boat. My sister is there.");
  assert.equal(out.title, 'Boat with my sister');
  assert.equal(out.updatedAt, T + 5);
});

test('tidy keeps a hand-edited title', () => {
  const e = mk('a boat', { title: 'Mine' });
  const [out] = applyTidy(e, { dreams: [{ title: 'Theirs', text: 'A boat.', transcript: 'a boat' }] });
  assert.equal(out.title, 'Mine');
});

test('tidy split: each dream gets its own slice', () => {
  const raw = 'i was at school and the halls were flooded then i had another dream i was on a jet ski with my dad';
  const e = mk(raw, { tags: ['vivid'] });
  const out = applyTidy(e, {
    dreams: [
      { title: 'Flooded school', text: "I'm at school. The halls are flooded.", transcript: 'i was at school and the halls were flooded' },
      { title: 'Jet ski with dad', text: "I'm on a jet ski with my dad.", transcript: 'then i had another dream i was on a jet ski with my dad' },
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, e.id);
  assert.notEqual(out[1].id, e.id);
  assert.equal(out[0].raw, 'i was at school and the halls were flooded');
  assert.equal(out[1].raw, 'then i had another dream i was on a jet ski with my dad');
  assert.deepEqual(out[1].tags, ['vivid']);
  assert.ok(out[1].createdAt > e.createdAt);
});

test('tidy split never loses raw text when slices are not faithful', () => {
  const raw = 'a dream about a red house and then i had another dream about the ocean and a whale';
  const out = applyTidy(mk(raw), {
    dreams: [
      { title: 'Red house', text: 'A red house.', transcript: 'a dream about a red house' },
      { title: 'Ocean', text: 'The ocean.', transcript: 'a dream about the sea' }, // invented
    ],
  });
  assert.ok(out.every((e) => e.raw === raw));
});

test('tidy split capped at four', () => {
  const words = 'one two three four five six';
  const dreams = words.split(' ').map((w) => ({ title: w, text: w, transcript: w }));
  assert.equal(applyTidy(mk(words), { dreams }).length, 4);
});

test('slicesAreFaithful tolerates punctuation and case, rejects gaps', () => {
  assert.ok(slicesAreFaithful('I was, um, flying. Then a dog!', ['i was um flying', 'then a dog']));
  assert.ok(!slicesAreFaithful('I was flying over the city at night then a dog', ['then a dog']));
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
  assert.match(exportFilename(T), /^dreams-\d{4}-\d{2}-\d{2}\.txt$/);
});
