# Dream Journal — Master Spec

**Status:** working web prototype built; native app not started.
**Working name:** undecided. Placeholder is "Dream Journal."
**Owner:** Kegan Bergeron
**Last updated:** 2026-09-22

---

## 0. How to read this

This is the full decision record for the app, assembled from the design conversation. Everything here is either **BUILT** (exists in the HTML prototype), **DECIDED** (agreed, not yet built), **BACKBURNER** (agreed it's fine, low priority), or **REJECTED** (explicitly ruled out, with the reason — do not re-propose).

Rejections matter as much as features. The whole product thesis is restraint.

---

## 1. Product thesis

**This is a dream journal. That is the entire product.**

You wake up from a dream. You have roughly ninety seconds before it disintegrates. The app exists to capture it inside that window, with the least possible cognitive and physical effort, while you are still mostly asleep.

Every feature decision routes back through one question: *does this help someone get a dream out of their head before it's gone?*

### The one interaction

> Roll over. Tap anywhere on the screen. Talk with your eyes half shut. Tap again. It's saved.

No typing. No navigation. No menus. No confirmation dialogs. Typing wakes you up; talking doesn't.

### Voice-first is a stance, not a feature

The app should actively teach and encourage voice over typing, because typing costs you the dream. Typing exists as a fallback for when the mic is unavailable, not as a co-equal path.

### Onboarding copy that sets the tone

> Any detail counts, no matter how small. A colour, a room, one face. Fragments are fine — you can clean it up later, in daylight.

---

## 2. Non-goals — hard rules

These are permanent. Do not build them, do not propose them, do not let scope creep reintroduce them.

| Not building | Why |
|---|---|
| **Friends list** | No social layer. Ever. |
| **Sharing / posting / feed** | No social layer. Ever. There is nowhere to post to. |
| **Accounts with public identity** | Nothing to follow, nothing to be followed. |
| Sleep tracking / sleep scores | Not a sleep app. |
| "How sleep affects your brain" education | Not a health app. |
| Diet, exercise, supplement tracking | Not a wellness app. |
| Dream interpretation / symbol dictionary | Pseudoscience. We are not your psychologist. |
| Therapy, advice, reflective prompting | Same. We are the middleman, not the analyst. |
| Streaks | You cannot control whether you dream or recall. Punishing someone for their brain is bad design. |
| Lucid dreaming coaching curriculum | Considered and cut. Too much app. |
| Binaural beats / YouTube recommendations | Weak evidence. Would be the one dishonest feature. |
| Generating images | We write the prompt. The user takes it elsewhere. |
| App passcode | The OS does it better. See §9. |
| Apple Watch app | Not now. |

**The one-trick-pony rule:** when in doubt, don't. This app does one thing.

---

## 3. Screens

### 3.1 Capture (default on open) — BUILT

The entire screen is the button.

- Dark indigo background. Low-luminance lavender type. Dimmer slider in the top bar (user-controlled, 0–72% black overlay).
- Idle state: a slow breathing dot, `What did you dream?`, and `Tap anywhere and start talking.`
- Recording: live transcript in large serif, interim words dimmer than finalized ones. Dot brightens and pulses faster.
- Tap again → saves, plays a tone, resets to idle, ready for the next one.
- Top bar: dimmer slider (left), `cancel` (recording only) and `Journal` (right). Everything else on screen is tap-to-record.
- Spacebar works on desktop.

**No confirmation on save.** Ever. The save must be unlosable and instant.

### 3.2 Journal — BUILT
Search field, filter pills, reverse-chronological list. Each row: timestamp, favorite star, status dots (`raw`, `private`, `Nd left`), title, two-line preview, tags.

### 3.3 Entry — BUILT
Editable title → dream text → word count → actions → original transcript (folded) → tags → note → image prompt → private toggle → delete.

### 3.4 Explore — BUILT
Four read-only AI tools. See §7.

### 3.5 Settings — BUILT
See §9, §10.

---

## 4. Capture — the hard requirements

These are the things that make or break the app. Everything here is **BUILT** in the prototype and must survive the native port.

### 4.1 Sounds — BUILT, needs real sound design

Users cannot watch the screen while half asleep. Audio is the feedback channel.

| Event | Current placeholder | Purpose |
|---|---|---|
| Recording started | Rising two-note sine (392 → 588 Hz) | Confirms it's listening |
| Dream saved | Single soft sine (523 Hz, 300ms) | Confirms it's safe |
| **Voice input dropped out** | **Falling two-note (588 → 370 Hz), louder** | **Critical — see below** |
| Recording discarded | Single low sine (330 Hz) | Confirms the cancel |

All sine waves, quiet, short. Paired with haptics. Single on/off toggle in Settings.

**TODO:** these are generated placeholders. Get real sounds designed. They should feel like they belong in a dark bedroom — soft, warm, non-alarming, audible at low volume without being startling. The dropout sound is the only one allowed to be slightly insistent.

### 4.2 Dropout detection — BUILT, highest-value feature

**The problem:** speech recognition silently dies mid-sentence. The user keeps talking to a dead mic and loses the dream. This is the single worst failure the app can have.

**The fix, as built:**
- `onstart` sets `running = true`; `onend` sets `running = false` and records the timestamp.
- Watchdog interval (900ms) checks: if we *want* to be recording but haven't been `running` for >2.6s, we've dropped.
- On drop: play the falling tone, vibrate `[40,70,40]`, show a banner, and stop cleanly.

**Banner copy:** `Voice input stopped on its own. Tap to pick up where you left off.`

Everything captured up to that moment is already persisted. The user loses nothing but the sentence they were mid-way through.

Also fires on `network` errors.

### 4.3 Wake lock — BUILT
`navigator.wakeLock.request('screen')` while recording; released on stop. Re-acquired on `visibilitychange` if still recording. Native equivalent: `isIdleTimerDisabled`.

### 4.4 Draft persistence — BUILT
Every finalized speech result writes immediately to local storage. If the app crashes, backgrounds, or the phone dies mid-dream, the text is there on next open with `unsaved — tap to keep going`.

**Known gap:** interim (non-finalized) results aren't persisted. Worth closing in native.

### 4.5 Cancel — BUILT
Two-tap confirm in the top bar, visible only while recording. `cancel` → `discard it?` → discarded. Reverts after 4 seconds.

Deliberately not a modal dialog. A modal at 4am is hostile.

### 4.6 Microphone permission — BUILT (priming), DECIDED (native)
**Ask exactly once, during onboarding, never at 4am.** The third onboarding screen asks for it explicitly:

> We need microphone access, and asking at 4am is the worst possible time. Let's get it out of the way now.

With a `Later` escape hatch.

### 4.7 Fallback typing — BUILT
If the mic is blocked, missing, or the browser can't do speech, the capture screen becomes a large serif textarea with a `save` button. Same visual language. Not promoted anywhere.

### 4.8 Language — DECIDED
**English only at launch.** Be honest about it. Multi-language is a real project, not a config flag.

---

## 5. Data model

```js
Entry {
  id:        string        // base36 timestamp + random
  createdAt: number        // ms epoch
  updatedAt: number
  raw:       string        // original transcript, always preserved, always editable
  polished:  string|null   // AI-tidied prose, null until tidied
  title:     string|null   // AI-generated or hand-edited
  note:      string        // freeform, optional, user's own words about that day
  tags:      string[]      // freeform. "lucid" is just a tag.
  fav:       boolean
  vault:     boolean       // private archive — see §9.2
  imgPrompt: string|null   // generated text-to-image prompt, user-editable
  deletedAt: number|null   // trash timestamp; purged after 30 days
}

Settings {
  sounds:     boolean  // default true
  localOnly:  boolean  // default false — kills all AI + sync
  onboarded:  boolean
  micPrimed:  boolean
}
```

### Storage strategy — BUILT
- **Local storage is the source of truth.** Writes are synchronous and instant. Losing a dream to a network failure is unacceptable.
- Cloud is a mirror, written fire-and-forget after the local write.
- On load: merge by `updatedAt`, newest wins. A tombstone list (`dead`) prevents deleted entries resurrecting from the cloud.
- `localOnly` mode short-circuits all cloud writes.

### Rules that must not be broken
1. **`raw` is never destroyed.** The AI writes to `polished`; the original stays underneath, visible and editable.
2. **Both fields are user-editable.** Fix a misheard word in the transcript, then re-tidy.
3. **Saving never blocks on the network.**

---

## 6. Tidy-up (the core AI feature) — BUILT

User speaks a jumbled half-asleep mess. Later, in daylight, they tap `Tidy up the transcript`. The AI rewrites it as readable prose. The original sits folded underneath with: *"Both are yours to edit. Fix a misheard word here, then tidy again."*

### 6.1 Multi-dream splitting — BUILT

**This replaced a rejected feature.** (Originally proposed: merge consecutive recordings into one entry. **Rejected** — a groggy user won't understand why their two dreams became one.)

Instead, the split happens at tidy time, where the AI can read the language. If someone says *"then I had another dream"* or *"oh and in a different one,"* it splits into separate entries, each with its own slice of the original transcript. Scene changes inside a single dream do **not** split — dreams jump around on their own. Capped at four.

Toast on split: `Heard 3 separate dreams — split them out`

### 6.2 Prompt (verbatim — this wording is load-bearing)

```
You tidy up dream-journal voice transcripts. Someone spoke this into their phone
seconds after waking, half asleep. It's fragmented, out of order, repetitive and
unpunctuated.

FIRST decide how many separate dreams are in here. People often say "then I had
another dream" or "oh and in a different one" — that's a boundary, split there.
Only split when they clearly signal a separate dream. A scene change inside one
dream is NOT a split; dreams jump around on their own.

For each dream, rewrite it as readable first-person present-tense prose:
- Keep every image, person, place, name, action and feeling. Invent nothing.
- Add no meaning, symbolism, tidy ending, or interpretation. You're a typist, not
  an author.
- Keep their uncertainty. "I think it was my mom, maybe" stays hedged.
- Cut filler, stammers, false starts, repeats. Add punctuation and paragraph breaks.
- If they corrected themselves, keep only the correction.
- Keep their vocabulary. Don't upgrade their words.
- If a stretch is too garbled to be sure of, leave the fragment in [brackets]
  rather than guessing.

Reply with only JSON:
{"dreams":[{"title":"3-6 concrete words from that dream's own images",
            "text":"the prose",
            "transcript":"the verbatim slice of the original transcript this
                          dream came from"}]}

Usually one dream. Never more than four.
```

**"You're a typist, not an author"** is the line that keeps the model from embellishing. Keep it.

---

## 7. Explore — BUILT

Four read-only tools. All four share one governing rule appended to every prompt:

```
Do NOT interpret. Never say what anything means, represents, symbolises or
suggests about the person. No psychology, no advice, no follow-up questions.
You are an index, not a therapist.
```

| Tool | Minimum dreams | What it does |
|---|---|---|
| **Repeats** | 4 | Concrete things appearing in 2+ dreams, counted. Returns empty rather than manufacturing patterns. |
| **Who and where** | 3 | Index of people and places named, with counts. Merges obvious variants ("my mom" / "mom"). |
| **This month** | 3 | Plain 3–5 sentence recap of the last 30 days. |
| **Ask your journal** | 1 | Free-text search by description. *"Dreams where I was late."* Returns real matches only. |

**Output format for Repeats:**
> *Water shows up in 3 — a flooded basement, a lake, rain through a ceiling.*

Then a footer: *"Just things we counted. Make of them what you want."*

That footer is the whole stance in one line. It says here's a fact, and stops.

---

## 8. Image prompt — BUILT

Button on each entry: **Turn it into an image prompt.**

- Picks the most visual moment, writes a 30–60 word text-to-image prompt.
- Only what's literally in the dream. No symbolism. No quality-tag spam (`8k, masterpiece, trending`).
- Keeps specifics: a jet ski, a blue door, their sister.
- **We do not generate the image.** The user copies the prompt into whatever tool they use.
- Output is a fully editable textarea with a Copy button and `Try another scene`.
- Footer copy: *"We probably didn't nail it. Edit it — it's just text."*

Deliberately humble. Handing someone editable text they can fix beats handing them a bad image they can't.

---

## 9. Privacy

### 9.1 No app lock — DECIDED (rejected)
We don't build a passcode. Settings says so plainly:

> We don't do a passcode. Your phone already does it better: hold the app icon and pick Require Face ID.

Don't reinvent OS security badly.

### 9.2 Private archive — BUILT

Some dreams are nobody's business. Sex dreams happen. This is normal and the app should be relaxed about it.

Per-entry toggle. A private dream is:
- Hidden from the main list and from search results
- **Filtered out of every AI corpus** — no tidying, no repeats, no index, no month recap, no image prompt
- Visible only under the `Private` filter
- Still included in the user's own export ("it's your file")

Implementation detail that matters: `corpusOf()` filters `vault` **and** `deletedAt` before anything is sent anywhere. That filter is the whole guarantee — it must never be bypassed.

### 9.3 Local-only mode — BUILT
One switch. Kills all AI and all cloud sync. Journal works identically.

> Keeps everything on this device. No tidying, no patterns, no image prompts, no sync. The journal still works exactly the same.

### 9.4 Erase everything — BUILT
Two-tap confirm. Wipes local and cloud.

> Erasing wipes this device and your synced copy. There's no account and nothing posted anywhere, so that's all of it.

**Native addition — DECIDED:** a `Delete account` button that does the same thing plus destroys the account record.

### 9.5 Trash — BUILT
Deleted dreams sit in trash for **30 days** with a per-entry countdown (`22d left`), then purge automatically. Restore or delete-forever from inside the entry.

---

## 10. Export & sync

- **Export — BUILT.** Plain `.txt`. Every dream, original transcript, note, tags. Private dreams included. Filename `dreams-YYYY-MM-DD.txt`. Plain text is the right call — it's all text anyway, and it's readable in fifty years.
- **Cross-device sync — BUILT (prototype), DECIDED (native).** Needs real accounts on native.
- **Backup / restore — UNDECIDED.** Export may cover it.
- **Import from other apps — BACKBURNER.** (Awoken, DreamKeeper, plain notes.) Low priority.

---

## 11. Native requirements

The web prototype proves the interaction. It cannot deliver the core promise, because **a web page cannot be opened with your eyes closed.** Unlock, find browser, find tab. These are the reasons to go native, in priority order:

| Feature | Status | Notes |
|---|---|---|
| **Action Button / back-tap → record** | DECIDED — "would be huge" | Starts recording before the screen fully lights. The single biggest unlock. |
| **Lock screen widget** | DECIDED | One tap from locked. |
| **Siri: "log a dream"** | DECIDED | App Intent. Zero screen interaction. |
| Morning reminder notification | DECIDED | Gentle nudge to tidy last night's capture. |
| Audio retention | DECIDED | Keep the recording, not just the transcript. Transcript is a lossy copy; audio catches tone and catches what the recognizer missed. Storage cost is low — it's short speech. |
| Bedside mode | BACKBURNER | App stays open all night, screen near-black, one tap to record. **Concern: tanks the battery.** Needs to be opt-in with an honest warning. |
| Apple Watch | REJECTED for now | |
| Photo attachment | DECIDED, low priority | Originally leaning no, then "sure." |

---

## 12. Monetization

**Rule #1: ads must never interrupt the flow of recording a dream.** Nothing on the capture screen, nothing after a save, nothing inside an entry. Breaking the capture flow breaks the product.

### Ad placement — DECIDED
- Bottom of the journal list ✅ (prototype has a marked placeholder slot)
- Possibly every N entries in a long list
- App-open interstitial — **only** if it can be guaranteed never to appear on a wake-from-sleep launch. Probably not worth the risk.

### Paid tier — DECIDED
- Unlimited AI (tidy, explore, image prompts)
- Audio storage
- Export

Free tier gets a monthly cap on AI tidies. Number TBD.

### Open idea — BACKBURNER
A printed book of your dreams. Real, physical, high-margin, and completely on-brand for something people keep for years.

---

## 13. Voice & copy

The app talks like a person who respects you and doesn't oversell.

**Do:**
- "Any detail counts, no matter how small."
- "Just things we counted. Make of them what you want."
- "We probably didn't nail it. Edit it — it's just text."
- "Both are yours to edit."
- "That's normal early on."
- "This is a dream journal. That's all it is."

**Don't:**
- Tell anyone what a dream means
- Claim the app improves sleep, health, or memory
- Congratulate anyone for a streak
- Use the word "journey," "insights," "unlock," or "wellness"
- Say "Are you sure?" when a two-tap confirm will do

---

## 14. Design

**Status: first pass only. Colour direction is not locked.**

Current placeholder palette — deep indigo / violet, "dark but friendly," explicitly not pure black:

```
night:  bg #0a0912   text #a79ecb   live #c9bfe8   warn #c98fa8
day:    bg #131120   raised #1c1930   text #e6e2f2   accent #a396e0
```

Type: **Newsreader** (serif) for dream text — dreams should read like a book. System sans for UI chrome.

**Explicit direction from Kegan:** *"I don't want it to look vibe-coded."* Build the foundation first, then do real design. Avoid the generated-app tells: near-black + one acid accent, everything in identical rounded cards, gradient hero, emoji section headers.

---

## 15. Feature ledger

**BUILT** — capture screen, dimmer, sounds, dropout detection, wake lock, draft persistence, cancel w/ confirm, typing fallback, tidy-up, multi-dream split, search, manual title edit, tags, favorites, notes, image prompts, private archive, trash + 30-day purge, Explore (4 tools), local-only mode, plain-text export, erase everything, cloud sync, three-screen onboarding, mic priming.

**DECIDED, NOT BUILT** — Action Button, lock screen widget, Siri intent, morning notification, audio retention, delete account button, photo attachment.

**BACKBURNER** — recurring-dream grouping, bedside mode, import from other apps, calendar view, printed book, backup/restore.

**REJECTED** — see §2.

---

## 16. Open questions

1. **Name.** Still unnamed.
2. **Stack.** Native Swift vs. React Native vs. Expo. Action Button + lock screen widget + Siri intents all push toward native Swift for iOS first.
3. **Speech engine.** On-device `SFSpeechRecognizer` vs. server. On-device is better for privacy and works offline, but drops out more. Given §4.2, dropout handling matters either way.
4. **Free tier AI cap.** What number?
5. **Sound design.** Needs a real pass.
6. **Interim-result persistence.** Close the gap in §4.4.
7. **Audio storage cost** at scale, if audio retention ships.

---

## 17. Prototype

Self-contained HTML, one file. Web Speech API, Wake Lock API, Web Audio for tones, localStorage as source of truth, cloud mirror, AI via sampling.

It's a proving ground for the interaction, not a foundation. The real app is native.

---

*End of spec.*
