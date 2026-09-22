# dream

A voice-first dream journal: tap anywhere, talk with your eyes half shut, tap again, it's saved.

The full decision record lives in [SPEC.md](SPEC.md). Read §2 (non-goals) before proposing anything.

## Run it

```sh
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start      # http://localhost:8787
```

- With no key, the journal works fully; tidying and Explore say they aren't set up.
- `npm run dev` runs with a stand-in AI (`DREAM_FAKE_AI=1`) that does crude mechanical versions of each task, so every screen can be clicked through without a key.
- `DREAM_MODEL` overrides the model (default `claude-opus-5`). `PORT` and `DREAM_DATA` (sync storage dir, default `./data/sync`) are also read.
- Voice needs a browser with speech recognition (Chrome, Edge, Safari) and HTTPS or localhost. Without it, the capture screen becomes a text box.

`npm test` runs the unit tests.

## Layout

```
public/            the app — plain HTML/CSS/JS, no build step
  core.js          pure journal logic: merge, corpusOf, trash, tidy/split, export
  app.js           capture, dropout watchdog, screens, sync client
  sw.js            offline shell so capture opens with no signal
server/
  server.js        static files + /api/ai + /api/sync
  prompts.js       every AI prompt (tidy revised per docs/AUDIT.md Part 6)
  ai.js            Claude calls with structured JSON output
  sync.js          cloud mirror, one merged blob per sync code
test/              node:test
docs/AUDIT.md      prototype audit and the fixes it led to
```

Things worth knowing:

- **Local storage is the source of truth.** The cloud copy is written after the fact and merged by `updatedAt`, with tombstones so deleted dreams stay deleted.
- **Prompts live on the server.** The client names a task (`tidy`, `repeats`, `who`, `ask`) and sends dreams; it can't send prompt text.
- **Private dreams never reach the AI.** Every AI call in `app.js` goes through one `ai()` function that refuses anything `corpusOf()` would drop, and Explore sends only `id`, `date` and `text`.
- **`raw` is never lost.** When a tidy splits one recording into several dreams, the model only names the first few words of each dream; the code cuts the transcript there, so every word lands in exactly one piece. The whole transcript as spoken is also kept, untouched, in `source`. If a start phrase can't be found, nothing is split.
- **Capture guards against silent failure.** A save is only confirmed once it's on disk. The watchdog catches a recognizer that dies (2.6 s), one that runs but hears nothing (8 s), and a user who falls asleep mid-recording (45 s of silence → saved). The dropout alert vibrates even with Sounds off.
- **Sync has no accounts.** Each device gets a random sync code; entering it on another device joins the same journal. This is prototype-grade. Native needs real accounts (SPEC §10).
- **Interim speech is persisted too**, which closes the gap noted in SPEC §4.4.
