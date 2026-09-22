# Dream Journal — Prototype Audit

Audited: `SPEC.md` (2026-09-22) and the prototype at commit `8c13925` (`public/`, `server/`).
Where a claim says **reproduced**, it was run in Chromium against the real app with a scripted speech recognizer, not just read off the code.

> **Status:** the Part 7 top 10 is done, and each fix was verified in Chromium against the reproduction that found it. Everything else in this audit is still open.

---

## Part 1 — Scorecard

No feature scores 10. One scores 9. Sorted lowest first.

| # | Feature | Score | The one-line problem |
|---|---|---|---|
| 27 | Word count / status metadata | 2 | Word count is decoration; "raw" is developer jargon on every row. |
| 4 | Stop-and-save | 3 | If the storage write fails, it plays the "saved" tone and deletes the draft. The dream is gone (reproduced). |
| 6 | Dimmer slider | 3 | One groggy tap near the top-left jumps the screen to a random brightness (reproduced). |
| 8 | Dropout detection | 3 | Catches a *dead* recognizer, not a *deaf* one; with Sounds off the alert is fully silent (both reproduced). |
| 11 | Draft persistence | 3 | Unfinalized words are dropped when the recognizer restarts after a pause (reproduced). |
| 30 | Multi-dream splitting | 3 | Up to 10% of the raw transcript can vanish; a 5th dream is truncated; the fallback path duplicates dreams on re-tidy. |
| 31 | Image prompt generation | 3 | Serves neither capture nor return. It's here because it seemed cool. |
| 35 | Explore: This month | 3 | A worse version of scrolling your own journal. |
| 40 | Local-first storage | 3 | localStorage caps out around 1,500 dreams, and past that point saves fail while the app still plays the success tone. |
| 56 | Performance at 500 / 2,000 | 3 | Every keystroke stringifies the whole journal twice; ~2,000 dreams exceeds the quota. |
| 57 | Monetization plan | 3 | Ad SDKs inside a private sex-dream diary, export behind a paywall, and uncapped Opus spend. |
| 3 | Live transcript display | 4 | Doesn't autoscroll. After ~60 words the new ones are below the fold (reproduced). |
| 5 | Save confirmation | 4 | Confirms things that didn't happen, and is inaudible on an iPhone in silent mode. |
| 10 | Wake lock | 4 | Held all night if the user falls asleep mid-recording, and while they browse the Journal. |
| 13 | Typing fallback | 4 | Once it triggers, there is no way back to voice this session. |
| 22 | Inline-editable dream text | 4 | "Tidy again" silently overwrites the user's hand edits. |
| 34 | Explore: Who and where | 4 | Model-counted numbers that aren't verified, and it duplicates Repeats. |
| 36 | Explore: Ask your journal | 4 | Silently searches only the newest 400 dreams. |
| 45 | Local-only mode | 4 | Doesn't remove the copy already on the server, despite what the copy implies. |
| 46 | Erase everything | 4 | A second joined device re-uploads everything; "that's all of it" is false. |
| 55 | Accessibility | 4 | aria-live reads every interim word aloud, font sizes are fixed px, and hint text sits at ~3.4:1 contrast. |
| 1 | Tap-anywhere-to-record | 5 | No guard against double-taps or a blanket touch ending the recording (reproduced). |
| 7 | Sound design (four tones) | 5 | Placeholders; the start tone is a rising fifth, the grammar of an alert. |
| 14 | Mic permission priming | 5 | "Later" pushes the permission prompt to 4am, and priming never tests that speech actually works. |
| 18 | Filter pills | 5 | "Untidied" turns tidying into homework; five tabs for a journal with twelve entries. |
| 20 | Entry detail ordering | 5 | The Private toggle is the last thing on the page, after an image prompt. |
| 24 | Tags | 5 | Comma-typed free text on a phone, no suggestions, so tags drift. |
| 26 | Note field | 5 | Nobody can say what it's for that the dream text isn't. |
| 28 | Tidy-up overall | 5 | No timeout, destructive on re-run, and fidelity checked loosely. |
| 29 | Tidy prompt | 5 | Forces present tense, drops dream shape-shifts as "corrections", and asks for verbatim slices it can't produce reliably. |
| 33 | Explore: Repeats | 5 | The LLM does the counting; colours and verbs produce noise. |
| 39 | AI error states | 5 | No client timeout; the button can spin for ~30 minutes. |
| 41 | Sync merge strategy | 5 | Whole-journal PUT on every edit; newest-wins by the device clock. |
| 49 | Onboarding structure | 5 | Three screens of reading, and never a rehearsal of the one gesture that matters. |
| 50a | Onboarding screen 1 copy | 5 | Opens by telling you what the app isn't. |
| 51 | Mic ask + "Later" | 5 | The escape hatch leads straight to the worst-case prompt at 4am. |
| 9 | Dropout banner + recovery | 6 | The copy is right; recovery takes two taps and reopens the mic when the user may only want to save. |
| 16 | Entry list layout | 6 | Untitled rows print the same words twice (title = first words, preview = same words). |
| 17 | Search | 6 | Sync re-render drops focus mid-typing; no match highlighting. |
| 19 | Empty states (composite) | 6 | "Everything has been tidied." scolds; "The next dream you tell it" is clumsy. |
| 23 | Original transcript, folded | 6 | Fine until a split fallback puts the full transcript under every piece. |
| 25 | Favorites | 6 | A tag with its own button. |
| 32 | Image prompt output UI | 6 | Moot if #31 is cut. |
| 38 | Minimum-dream thresholds | 6 | Four dreams is too few for "repeats" to mean anything. |
| 42 | Private archive (vault) | 6 | Private dreams sit in plaintext on the sync server; the toggle is buried. |
| 52 | Visual design and palette | 6 | Dark everywhere, including the daylight half; a single lavender accent. |
| 53 | Typography | 6 | Newsreader loads from Google Fonts and blocks first paint on bad signal. |
| 12 | Cancel two-tap | 7 | Lives in the hardest spot to reach one-handed lying down. |
| 44 | Trash + 30-day purge | 7 | Delete has no undo on the toast; purge runs only at boot. |
| 48 | App-lock position (§9.1) | 7 | Right call; the instruction is iOS-only and shows on Android too. |
| 54 | The app's voice | 7 | Strong, with a handful of lapses ("raw", "Untidied", "The AI declined that one"). |
| 58 | Information architecture | 7 | Right screens; Explore doesn't earn a top-level destination. |
| 2 | Idle screen + copy | 8 | Hint sits at ~3.4:1 contrast. |
| 15 | Spacebar / keyboard | 8 | Space stops working after the dimmer has focus. |
| 21 | Editable title | 8 | No way to get back the AI title after clearing it. |
| 37 | Shared "index, not a therapist" rule | 8 | "Anything that came up more than once" in the Month prompt partly undercuts it. |
| 43 | `corpusOf()` as privacy guarantee | 8 | Holds on the client; the server can't enforce it, and the Explore cache outlives a vault toggle. |
| 47 | Plain-text export | 8 | Trashed dreams excluded without saying so. |
| 50c | Onboarding screen 3 copy | 8 | "Let's get it out of the way now" — fine; the button should say what it does next. |
| 50b | Onboarding screen 2 copy | 9 | Marginal: "colour" (en-GB) in an en-US product. |

**Changes for the 8s and 9s** (each score below 10 needs one):
- **#2** Raise `.night .hint` opacity from `.6` to `.78`. That's ~4.6:1 against `#0a0912`.
- **#15** In the keydown handler, blur the range input and fall through when `e.target.type === 'range'`.
- **#21** When the title is cleared, restore the last AI title as the placeholder instead of "Untitled".
- **#37** In the Month prompt, delete "anything that came up more than once". Repeats already does that job.
- **#43** Clear `exploreResults` whenever any entry's `vault` or `deletedAt` changes. Have `/api/ai` reject input that has fields beyond `{id,date,text}`.
- **#47** Add a line at the top of the export: `Trash is not included.`
- **#50c** Change the button from "Allow microphone" to "Allow microphone and test it" (see Gap 3).
- **#50b** Change "colour" to "color".

---

## Part 2 — Detailed findings (7 and below)

### A. Capture

## [4] Stop-and-save — 3/10
**What's wrong:** `saveDraftAsEntry` calls `upsert` (whose `LS.set` swallows a quota error into a toast), then plays `feedback.saved()`, then `resetCapture()` deletes the draft. **Reproduced:** with writes to `dj.entries` failing, the user gets the save buzz `[30]`, `dj.entries` is `[]`, and `dj.draft` is `null`. The dream exists only in memory until the tab closes.
**Why it matters:** This is the one promise the app makes. At 4:14am the user hears "saved", rolls over, and loses the dream. It happens to exactly the users who keep the app: a quota failure comes after ~1,500 dreams (see #40).
**The fix:** `persist()` returns a boolean. In `saveDraftAsEntry`, write, then re-read `dj.entries` and confirm the new id is present. Only then play the saved tone and delete the draft. On failure, keep the draft, play the dropout tone, and show `Couldn't save — it's still here. Tap to try again.`
**Effort:** trivial
**Score after the fix:** 8/10

## [6] Dimmer slider — 3/10
**What's wrong:** A range input in the top-left of a screen whose rule is "tap anywhere". Taps in the bar are excluded from recording, so a groggy tap near the top lands on the slider and sets it to wherever the finger fell. **Reproduced:** one tap at (100, 29) jumped the overlay to 54%. Tap further right and the screen goes to full brightness at 4am.
**Why it matters:** The control meant to protect dark-adapted eyes is the most likely thing on screen to blast them. Nobody adjusts a slider while mostly asleep; it's a set-once preference.
**The fix:** Remove the slider from the capture screen. Ship the capture screen dim by default (text at `#a79ecb` on `#0a0912` is already low), and add a one-line setting `Capture screen brightness: Dim / Dimmer / Darkest` (overlay 0 / 35 / 60%) in Settings.
**Effort:** trivial
**Score after the fix:** — (deleted from capture; setting scores 8)

## [8] Dropout detection — 3/10
**What's wrong:** Three holes, all silent.
1. **Deaf recognizer.** The watchdog only checks `running`. A recognizer that is running but returning nothing (wrong input device, Bluetooth routing, a muted mic, Android's recognizer stuck) never trips it. **Reproduced:** 5 s of recording with no results stays in `recording`; the second tap saves nothing, and the only feedback is the start buzz from 5 s earlier.
2. **Sounds off = silent alarm.** `buzz()` is gated on `settings.sounds`. **Reproduced:** with Sounds off, a dropout produces a banner and zero vibrations. A person with eyes shut will not see the banner.
3. **iPhone web.** `navigator.vibrate` doesn't exist in iOS Safari, and the ring/silent switch mutes Web Audio. On an iPhone on silent, which most phones are overnight, the dropout alert makes no sound and no vibration.
**Why it matters:** This is the feature the spec calls highest-value, and it only covers the failure mode that's easiest to detect.
**The fix:**
(a) Track `cap.lastResultAt`. If recording has run 8,000 ms with zero results since start, fire `dropout('deaf')` with the same tone and the banner `Not hearing anything. Tap to try again.`
(b) `feedback.dropped()` always vibrates, whatever the Sounds setting; the toggle covers only the start/save/discard tones.
(c) Put the iOS silent-switch limitation in the native requirements: `AVAudioSession` `.playback` category plus `UINotificationFeedbackGenerator(.error)` for dropout.
**Effort:** hours
**Score after the fix:** 8/10 on web (9 native)

## [11] Draft persistence — 3/10
**What's wrong:** `rec.onend` doesn't fold `cap.interim` into `cap.finalText` before restarting. The next `onresult` overwrites `cap.interim`, and `persistDraft()` writes the overwrite. **Reproduced:** interim "i was in a red kitchen" → recognizer ends on a pause → restart → interim "and a dog came in" → draft is `and a dog came in`. The kitchen is gone. Browsers end sessions on every few seconds of silence, and people pause constantly while recalling a dream, so this fires routinely.
There's also a state trap. A restored draft (`unsaved — tap to keep going`) can't be saved or discarded without reopening the mic: tap starts recording (start tone), then tap again to save, or reach the top bar to cancel twice.
**Why it matters:** Silent loss of a sentence per pause. The spec's §4.4 "known gap" was claimed closed; it's closed only until the first pause.
**The fix:** In `onend`: `cap.finalText = join(cap.finalText, cap.interim); cap.interim = ''; persistDraft();` before scheduling the restart. In the draft state, show two text buttons under the transcript: `save it` and `keep going`. A tap on empty space should *save*, not resume. A restored draft means the moment has passed.
**Effort:** trivial
**Score after the fix:** 8/10

## [3] Live transcript display — 4/10
**What's wrong:** `#transcript` has `max-height: 60vh; overflow-y: auto` and nothing ever scrolls it. **Reproduced:** with a long dream, `scrollTop` is 0 and `scrollHeight` is 4031 against a 506 px viewport. New words render off-screen. Also: `aria-live="polite"` on a node that changes 5×/second, and full-luminance `#c9bfe8` 32 px text is the brightest thing in the room.
**Why it matters:** A user who glances at the screen sees the text frozen and concludes it stopped listening, so they stop talking or tap to "restart", which saves mid-sentence.
**The fix:** After each paint, `t.scrollTop = t.scrollHeight`. Cap the visible transcript at the last 4 lines (`max-height: calc(4 * 1.4em)`) with a top fade mask. Drop the finalized text to `#a79ecb` and leave only the newest interim words at `#c9bfe8`. Remove `aria-live` from `#transcript` and announce state changes (recording / saved / stopped) through a separate `role="status"` node.
**Effort:** trivial
**Score after the fix:** 8/10

## [5] Save confirmation — 4/10
**What's wrong:** It's a 300 ms 523 Hz sine plus a 30 ms buzz, with no visual trace. It fires on failed saves (#4). An empty stop (nothing heard) plays nothing at all, so to a user with eyes shut, silence after a tap is ambiguous. On iOS web it's inaudible in silent mode.
**Why it matters:** The user needs to hear the difference between "saved" and "nothing was saved" without looking.
**The fix:** Three outcomes, three sounds.
- Saved: a two-note falling-to-resolved figure (523 → 392 Hz, 180 ms each), plus buzz 30.
- Nothing heard: the discard tone (330 Hz), plus buzz `[15,60,15]`.
- Save failed: the dropout tone.
After a successful save, the idle screen shows `Saved · 4:14am` at hint luminance until the next recording (see Gap 4).
**Effort:** trivial
**Score after the fix:** 8/10

## [10] Wake lock — 4/10
**What's wrong:** (1) The thesis says the user falls asleep within two minutes. If they fall asleep before the second tap, nothing ever ends the recording: the wake lock holds the screen on all night, the recognizer keeps restarting and transcribing snoring and a partner's voice into the draft, and the entry isn't saved until morning. (2) Navigating to Journal while recording keeps the mic and wake lock alive invisibly. **Reproduced:** state stays `recording` on `#/journal`.
**Why it matters:** A screen lit all night next to someone asleep, a drained battery, and a draft polluted with noise. This is the likeliest way the app gets deleted in week two.
**The fix:** (1) Silence auto-save (Gap 1): after 45,000 ms with no new result, save, play the saved tone at half gain, and release the lock. (2) While `cap.want`, hide `#to-journal` and the dimmer, and in `render()` call `stopAndSave()` if leaving capture while recording.
**Effort:** hours
**Score after the fix:** 8/10

## [13] Typing fallback — 4/10
**What's wrong:** `micBlocked()` sets `cap.blocked = true` for the session. The only way back is the Permissions API `onchange`, which iOS Safari doesn't support. `audio-capture` (the mic is busy, e.g. during a call, or another app holds it) is treated as a permission refusal and shows `The microphone is off for this app. Allow it in your browser settings`, which is false.
**Why it matters:** One transient mic conflict turns the voice-first app into a typing app until reload, with instructions that don't apply.
**The fix:** Add a `try voice again` text button to the typing footer that clears `cap.blocked` and calls `startRecording()`. For `audio-capture`, show `Another app is using the microphone.` and don't set `blocked`: dropout instead, so the next tap retries.
**Effort:** trivial
**Score after the fix:** 8/10

## [1] Tap-anywhere-to-record — 5/10
**What's wrong:** Start and stop are the same gesture with no debounce. **Reproduced:** a double-tap starts and stops in one motion and saves nothing, silently. Any stray touch (palm, blanket, cheek, rolling over) ends the recording mid-sentence; the user keeps talking to an idle screen.
**Why it matters:** The gesture is right for starting and wrong for stopping as specced. Stopping is the one action where an accident costs content.
**The fix:** Ignore stop taps within 1,200 ms of start. Stopping remains a tap, but silence auto-save (Gap 1) becomes the primary way a recording ends. After any stop, if speech was mid-flow (an interim result under 1,000 ms old), keep listening for 1,500 ms and append before saving.
**Effort:** trivial
**Score after the fix:** 8/10

## [7] Sound design — 5/10
**What's wrong:** Pure sines are placeholders, as the spec admits. Specific problems: the start tone (392 → 588 Hz) is a rising perfect fifth, the interval of notification chimes, which reads as "attention" rather than "listening". Saved (single 523 Hz) and discarded (single 330 Hz) differ only in pitch, and a half-asleep ear won't tell them apart. The dropout tone, the one that matters most, is only 2.4× louder (gain 0.12 vs 0.05).
**Why it matters:** Audio is the only feedback channel at 4am. Four tones that differ by pitch alone are one tone.
**The fix:** Distinguish by *shape*, not pitch.
- Start: a single soft 440 Hz with a 60 ms attack.
- Saved: two notes, 523 → 392, 160 ms each.
- Discarded / nothing heard: one 262 Hz with a 250 ms decay.
- Dropout: three quick 440 Hz pulses, 80 ms on / 70 ms off, at 0.15 gain, with a 3-pulse vibration.
Then commission real sounds from that brief.
**Effort:** hours (the placeholders), days (real design)
**Score after the fix:** 7/10 placeholders, 9 designed

## [14] Mic permission priming — 5/10
**What's wrong:** It asks at the right time, but only asks. It never checks that speech recognition works end to end (recognizer present, network reachable for server recognition, correct input). On iOS web, mic grants don't persist across sessions, so priming doesn't prevent the 4am prompt there.
**Why it matters:** The first real test of the whole pipeline happens at 4am.
**The fix:** Replace priming with a rehearsal (Gap 3): the third screen says `Try it once. Tap the screen, say "a blue door", tap again.` and shows the result. On success: `That's all there is to it.` On failure, show the specific reason now, in daylight.
**Effort:** hours
**Score after the fix:** 8/10

## [51] Mic ask + "Later" — 5/10
**What's wrong:** "Later" has no later. The next time the question comes up is the first recording, at 4am, as a browser permission sheet, which is the exact scenario §4.6 was written to avoid.
**Why it matters:** Users who tap "Later" (most people skipping through onboarding) get the worst version of the app on their first real use.
**The fix:** After "Later", show on the idle capture screen, in daylight hours only (07:00–22:00 local), a single line: `Voice isn't set up yet. Tap here to do it now.` Remove it once permission is granted.
**Effort:** trivial
**Score after the fix:** 8/10

## [9] Dropout banner + recovery — 6/10
**What's wrong:** The copy is right: `Voice input stopped on its own. Tap to pick up where you left off.` But the only recovery is to resume, which plays a start tone and reopens the mic. A user who has nothing more to say must resume and then tap again to save, two taps and a decision.
**Why it matters:** After a dropout the user is at the edge of sleep; the path to "safe" should be zero taps.
**The fix:** On dropout, auto-save what was captured as an entry immediately (it's already persisted). The banner becomes `Voice input stopped on its own. What you said is saved. Tap to keep going.` A tap resumes *into the same entry* (store `cap.resumeId` and append to its `raw`).
**Effort:** hours
**Score after the fix:** 9/10

## [12] Cancel two-tap — 7/10
**What's wrong:** The mechanism is right, but it sits in the top-right corner, the hardest reach for a one-handed grip on a phone held overhead, in 15 px text.
**Why it matters:** It's rare, so the cost is low, but when someone wants it (they said something they don't want kept) they can't find it half-asleep.
**The fix:** Keep it in the bar but raise the hit target to 44×44 px. A 3-second hold anywhere during recording arms the discard, and a tap confirms. The label stays `discard it?`.
**Effort:** trivial
**Score after the fix:** 8/10

### B. The journal

## [27] Word count / status metadata — 2/10
**What's wrong:** "N words" under every dream has no use. The `raw` dot on list rows is developer vocabulary and implies unfinished work.
**Why it matters:** Two more things to parse on every row and entry, for zero value.
**The fix:** Delete the word count. Delete the `raw` dot. Keep `private` and `Nd left`, which carry meaning.
**Effort:** trivial
**Score after the fix:** — (deleted)

## [22] Inline-editable dream text — 4/10
**What's wrong:** Editing the tidied text, then tapping "Tidy again", replaces `polished` with fresh model output. The user's edits vanish without warning. Separately, typing into `#text` while a tidy is in flight is overwritten when the result lands.
**Why it matters:** The spec's promise is "both are yours to edit". Destroying the user's own words on a button press breaks it.
**The fix:** Tidy always works from `raw` (it already does). If `polished` has been edited since the last tidy (track `polishedByAI` hash), the button becomes a two-tap: `Tidy again` → `replace your edits?`. Disable `#text` (`readonly`) while a tidy is in flight.
**Effort:** trivial
**Score after the fix:** 8/10

## [18] Filter pills — 5/10
**What's wrong:** Five tabs: All, Favorites, Untidied, Private, Trash. "Untidied" frames tidying as a chore list. Private and Trash are places, not filters, and they sit on the same row as filters.
**Why it matters:** At 9:30am the user wants to read, not triage.
**The fix:** Delete "Untidied". Rename the row to three: `All · Starred · Private`. Move Trash to a text link at the bottom of the list: `Trash (3)`, shown only when non-empty.
**Effort:** trivial
**Score after the fix:** 8/10

## [20] Entry detail ordering — 5/10
**What's wrong:** Order today: title, text, word count, Tidy/Favorite, transcript, tags, note, image prompt, **Private**, Delete. The one control a user may need urgently (hide this now) is last, below an AI feature.
**Why it matters:** The sex-dream case in §9.2 is the case where someone opens the entry specifically to hide it.
**The fix:** Put Private in the top bar of the entry as a text toggle (`make private` / `private ✓`), opposite `← Journal`. The body becomes: title, text, Tidy, original transcript, tags, Delete.
**Effort:** trivial
**Score after the fix:** 8/10

## [24] Tags — 5/10
**What's wrong:** Comma-separated free text on a phone keyboard, with no suggestions, so `lucid`, `lucid dream` and `lucid-ish` drift apart. It commits on `change`, so the user doesn't see the parsed result until blur.
**Why it matters:** Tags only pay off if they're consistent.
**The fix:** Under the field, show the user's 8 most-used existing tags as tappable text chips; tapping adds one. Keep free text for new ones.
**Effort:** hours
**Score after the fix:** 7/10

## [26] Note field — 5/10
**What's wrong:** "Anything about that day, in your own words." Which day, the day before the dream or the morning after? And why not in the dream text, which is also editable and also theirs?
**Why it matters:** A field whose purpose the builder can't state is a field the user will skip or misuse.
**The fix:** Either cut it (Part 4 argues keep-but-fold) or give it one job: label `The day before`, placeholder `What happened yesterday, if it seems related.`
**Effort:** trivial
**Score after the fix:** 6/10

## [16] Entry list layout — 6/10
**What's wrong:** For an untitled entry the title is the first seven words and the preview starts with the same seven words, visible in the screenshots (`half a dream about owls` / `half a dream about owls`). Timestamps show `5:24pm` with the full weekday for every row.
**Why it matters:** Duplicated text halves the information on screen.
**The fix:** When `!e.title`, render no `<h2>`; show the preview at title size and clamp to 3 lines. Group rows under date headers (`Tuesday 22 September`) and show only the time on each row.
**Effort:** trivial
**Score after the fix:** 8/10

## [17] Search — 6/10
**What's wrong:** Any sync `adopt()` while on the Journal re-renders the page and drops focus from the search field mid-word. There's no match highlighting, so on a long dream the user can't see why it matched.
**Why it matters:** Search is the main daylight use.
**The fix:** In `adopt()`, when on the Journal, call `paintRows()` instead of `render()`. Wrap matches in `<mark>` in the preview, and show the preview window around the first match instead of the first two lines.
**Effort:** hours
**Score after the fix:** 8/10

## [19] Empty states — 6/10 (composite)
- **All** — 6: `Nothing yet. The next dream you tell it goes here.` "Tell it" is clumsy. → `Nothing yet. Your next dream goes here.`
- **Favorites** — 8: fine; becomes `Nothing starred yet.` after the rename.
- **Untidied** — 2: `Everything has been tidied.` is a completion badge for a chore. Deleted along with the filter.
- **Private** — 8: `Nothing private. Any dream can be moved here from its page.` Fine.
- **Trash** — 8: `Trash is empty. Deleted dreams wait here for 30 days.` Fine.
- **Search, no results** — 6: `No dreams match that.` → `Nothing matches "owls".`, echoing the query so a typo is visible.
- **Explore, under threshold** — 8: `Needs at least 4 dreams. You have 3. That's normal early on.` Good.
**Effort:** trivial
**Score after the fix:** 8/10

## [23] Original transcript, folded — 6/10
**What's wrong:** Works as specced, but on the split-fallback path (#30) every piece shows the *full* original transcript, so the fold under dream 2 contains dream 1.
**The fix:** Covered by the anchor-based split in #30: each piece gets its exact slice, and the untouched full original is stored once in `source`.
**Effort:** hours (with #30)
**Score after the fix:** 8/10

## [25] Favorites — 6/10
**What's wrong:** A boolean duplicating what a tag does, with its own button and its own filter.
**The fix:** Keep, since it's one tap and people use stars, but rename to `Star` / `Starred` so it's a mark, not a ranking. Remove the star from the button label when unset (`Star`, not `☆ Favorite`).
**Effort:** trivial
**Score after the fix:** 7/10

### C. AI

## [30] Multi-dream splitting — 3/10
**What's wrong:**
1. `slicesAreFaithful` passes when the slices cover ≥90% of words. Up to 10% of the raw transcript can be dropped from every piece, which breaks spec §5 rule 1, "raw is never destroyed".
2. `slice(0, MAX_SPLIT)` truncates a 5th dream. If it's short, coverage stays ≥90% and it's gone from both `raw` and `polished`.
3. When slices fail the check, every piece gets the full original `raw`. "Tidy again" on any piece re-splits it, producing duplicate dreams, and it compounds each time.
**Why it matters:** The split feature is the one place the app deliberately rewrites `raw`, and its guard has a 10% hole.
**The fix:** Stop asking the model for verbatim slices. Ask for `starts_with` (the first 6–10 words of each dream, copied exactly) and cut the transcript in code at those anchors, so every word lands in exactly one piece by construction. If any anchor isn't found, don't split: return one entry whose `polished` is the dreams joined with a blank line and `* * *`. Add `source: string` to the entry at split time, holding the complete pre-split transcript, and never modify it. If the model returns >4 dreams, merge dreams 4..n into the 4th in code.
**Effort:** hours
**Score after the fix:** 8/10

## [31] Image prompt generation — 3/10
**What's wrong:** Measured against the thesis, it helps neither capture nor return. It exists because turning dreams into images is a demo. The spec's own footer ("We probably didn't nail it") concedes the output is weak. It costs a model call per press and a section on every entry page.
**Why it matters:** It's the one feature a reviewer would call "AI for the sake of AI" in a product whose credibility depends on not doing that.
**The fix:** Delete it. See Part 4.
**Effort:** trivial
**Score after the fix:** — (deleted)

## [35] Explore: This month — 3/10
**What's wrong:** A 3–5 sentence summary of dreams the user can scroll through in less time than the model takes to answer. The prompt's "anything that came up more than once" duplicates Repeats.
**Why it matters:** One of four Explore tools is filler, which makes Explore look padded.
**The fix:** Delete it. See Part 4.
**Effort:** trivial
**Score after the fix:** — (deleted)

## [28] Tidy-up overall — 5/10
**What's wrong:** It's the right feature, with the wrong failure behavior: no client timeout (#39), destructive on re-run (#22), a loose fidelity guard (#30), and `effort: 'medium'` on Opus for a transcription job, so each tidy takes 10–30 s.
**The fix:** Apply #22, #30 and #39. Keep Opus for quality, set `effort: 'low'` (a typist task, not a reasoning task), and show `Tidying…` with no spinner.
**Effort:** hours
**Score after the fix:** 8/10

## [29] Tidy prompt — 5/10
Full line-by-line treatment in Part 6. In short: it forces present tense (authorship, not typing), its correction rule deletes dream shape-shifts, "cut repeats" deletes repetition that is dream content, it has no rule for misheard words or recording chatter, and it asks for verbatim transcript slices, which models don't reliably produce.
**The fix:** Use the rewrite in Part 6.
**Effort:** trivial (text) + hours (the anchor split in code)
**Score after the fix:** 8/10

## [33] Explore: Repeats — 5/10
**What's wrong:** The model does the counting. LLM counts over hundreds of documents are unreliable, and the footer promises "Just things we counted." Colours and actions are in scope, so `blue` and `walking` will top the list. `examples` isn't verified against the text.
**Why it matters:** "We counted" is a factual claim; if the number is wrong, the one line the product is proudest of becomes a lie.
**The fix:** Schema: `items: [{thing, dream_ids: [..], examples: [..]}]`. The count is `dream_ids.filter(validId).length`, computed in code. Drop items under 2 after validation. In the prompt, exclude colours unless they're a named object's colour, and exclude generic actions.
**Effort:** hours
**Score after the fix:** 8/10

## [34] Explore: Who and where — 4/10
**What's wrong:** Same counting problem as Repeats. It's also a subset of Repeats (people and places are "concrete things"), so two tools answer one question.
**The fix:** Fold it into Repeats as two sections, `People` and `Places`, above `Things`, one call, verified ids. See Part 4.
**Effort:** hours
**Score after the fix:** 8/10 (as part of Repeats)

## [36] Explore: Ask your journal — 4/10
**What's wrong:** `server/ai.js` caps input at `MAX_DREAMS = 400`, and the client sends newest-first. At dream 401, Ask silently stops seeing the oldest dreams, and "No dreams matched" becomes a false negative. Each question also sends the whole corpus to Opus, costing roughly $0.50–1.50 per query at 400 dreams.
**Why it matters:** "Returns real matches only" is honest about false positives and silent about false negatives.
**The fix:** Run a local keyword prefilter first (`listFor` with the query words). If it finds matches, show them immediately with no model call. Only for descriptive queries, send the model at most 400 dreams chosen by recency, and show `Looked through your latest 400 dreams.` when truncated. Verify each returned `line` appears in its dream's text (normalized substring), and drop hits that don't.
**Effort:** hours
**Score after the fix:** 7/10

## [38] Minimum-dream thresholds — 6/10
**What's wrong:** Repeats unlocks at 4 dreams. With 4 dreams, anything appearing twice is noise ("a house" in 2 of 4). The threshold is set to unlock early, not to be useful.
**The fix:** Repeats (with people and places folded in) unlocks at 10. Ask stays at 1. Under-threshold copy: `Needs about 10 dreams before repeats mean anything. You have 4.`
**Effort:** trivial
**Score after the fix:** 8/10

## [39] AI error states — 5/10
**What's wrong:** No `AbortController` on the client fetch. The SDK's default timeout is 10 minutes with 2 retries, so a hung call leaves `Tidying…` on screen for up to ~30 minutes. Malformed model JSON becomes a 502 and the generic `That didn't work.` A refusal says `The AI declined that one.`, which is odd in a product that otherwise avoids "the AI".
**The fix:** Client timeout 45,000 ms, then `That took too long. Nothing was changed.` Server: `new Anthropic({ timeout: 40_000, maxRetries: 1 })`. Refusal copy: `Couldn't tidy this one. Nothing was changed.`
**Effort:** trivial
**Score after the fix:** 8/10

## [32] Image prompt output UI — 6/10
Deleted with #31. If it survives, cut `Try another scene`: a second roll of the dice is the feature admitting the first roll is usually wrong.

### D. Data, privacy, trust

## [40] Local-first storage — 3/10
**What's wrong:** `localStorage` holds ~5 M UTF-16 chars per origin. An entry with raw + polished + metadata is ~3 KB, so about 1,500 dreams fill it. Past that, every save fails into the false-success path in #4. It also rewrites the entire journal on every debounced keystroke.
**Why it matters:** The failure hits the most committed users, silently, a year or two in.
**The fix:** Move entries to IndexedDB, one record per entry (`put` a single entry per change). Keep `localStorage` only for the in-flight draft (small, synchronous, crash-safe). Call `navigator.storage.persist()` on first save so the browser doesn't evict the journal under storage pressure.
**Effort:** days
**Score after the fix:** 8/10

## [56] Performance at 500 / 2,000 — 3/10
**What's wrong:** At 500 dreams (~1.5 MB): every debounced keystroke in an entry does `JSON.stringify` of the whole journal for localStorage, and then `adopt()` stringifies it twice more to compare. Each push uploads the entire journal. `paintRows` rebuilds all rows on every search keystroke. That's noticeable jank on a mid-range Android. At 2,000: past the quota (#40), so saves fail.
**The fix:** IndexedDB per-entry writes (#40). Sync sends only entries changed since `lastSync` (`updatedAt > lastSync`) plus new tombstones. `adopt()` compares by id and `updatedAt`, not by stringifying. The list renders the first 100 rows and appends more on scroll, and search debounces at 120 ms.
**Effort:** days
**Score after the fix:** 8/10

## [41] Sync merge strategy — 5/10
**What's wrong:** Newest-wins by device clock, per whole entry. A phone with a wrong clock wins every conflict. An edit to the title on device A and to the note on device B within the same window loses one of them. The whole state goes up on every edit.
**The fix:** Per-field `updatedAt` for `title`, `polished`, `raw`, `note`, `tags`, `fav`, `vault`, `deletedAt`, merged field by field. Server-assigned `rev` numbers instead of client clocks for ordering. Delta push as in #56.
**Effort:** days
**Score after the fix:** 8/10

## [45] Local-only mode — 4/10
**What's wrong:** The toggle stops future sync, but everything already pushed stays on the server. The copy, `Keeps everything on this device.`, reads as though the cloud copy doesn't exist.
**The fix:** When turning it on, arm a two-tap: `Keep everything on this device` → `and delete the synced copy?` → call `DELETE /api/sync` and rotate the sync key.
**Effort:** trivial
**Score after the fix:** 8/10

## [46] Erase everything — 4/10
**What's wrong:** It erases this device and the server blob under the current key, then rotates this device's key. A second device that joined with the old key still holds the journal and re-uploads it on its next push. `There's no account and nothing posted anywhere, so that's all of it.` is false the moment a second device has joined.
**The fix:** On erase, the server writes a tombstone blob `{erasedAt}` under the old key instead of deleting it. Any device that pulls it wipes itself and shows `This journal was erased from another device.` Keep the copy, now true.
**Effort:** hours
**Score after the fix:** 8/10

## [42] Private archive — 6/10
**What's wrong:** "Private" excludes a dream from AI and from the list, but syncs it to the server in plaintext. The copy, `Never sent to any AI.`, is literally true and still misleading about where it goes. The toggle is at the bottom of the page (#20).
**The fix:** Say it: `Hidden from the list and search. Never sent to any AI. Still synced to your other devices.` In native, encrypt vault entries client-side with a key held in the Keychain before sync.
**Effort:** trivial (copy), days (encryption)
**Score after the fix:** 8/10

## [44] Trash + 30-day purge — 7/10
**What's wrong:** Delete shows `Moved to trash. It stays there for 30 days.` with no way to undo from the toast; the user has to find the Trash tab. Purge runs only at app launch, so on a device that's never relaunched, the countdown can hit `0d left` and stay there.
**The fix:** The toast gets an `Undo` action for 5 s. Purge also runs on `visibilitychange` → visible.
**Effort:** trivial
**Score after the fix:** 8/10

## [48] App-lock position (§9.1) — 7/10
**What's wrong:** The position is right. The instruction, "hold the app icon and pick Require Face ID", is iOS 18 only and is shown to Android and desktop users verbatim.
**The fix:** Branch the copy by platform. Android: `Use your phone's app lock (Settings → Security → App lock, or Private Space).` Desktop web: drop the section.
**Effort:** trivial
**Score after the fix:** 8/10

### E. Onboarding

## [49] Three-screen structure — 5/10
**What's wrong:** Three screens of reading and zero practice. The only behavior the app needs to teach is a physical one (tap, talk, tap), and it's taught with prose. If first launch happens at 4am (installed before bed, never opened), the user meets three screens of text in the dark.
**The fix:** Two screens. (1) The pitch and permission together. (2) The rehearsal (Gap 3). If the local time is 00:00–06:00 at first launch, skip onboarding entirely, go straight to capture, and run onboarding at the next daytime open.
**Effort:** hours
**Score after the fix:** 8/10

## [50a] Screen 1 copy — 5/10
**What's wrong:** `This is a dream journal. That's all it is.` A new user doesn't yet know what else it might have been; the line answers a question they didn't ask and reads as defensive. The body, `…roll over, tap anywhere on the screen and talk. Tap again and it's saved. No typing, no menus.`, is the real pitch and is buried under it.
**The fix:** Headline: `Tap. Talk. Tap.` Body: `When you wake up from a dream, tap anywhere and say what you remember. Tap again and it's saved. You can tidy it up later, in daylight.` Move "That's all it is" to the colophon only.
**Effort:** trivial
**Score after the fix:** 8/10

### F. Cross-cutting

## [57] Monetization plan — 3/10
**What's wrong:** Three problems. (1) Ads mean third-party ad SDKs, which mean device identifiers and tracking inside a product whose trust story is "no account, nothing posted anywhere", holding sex dreams. (2) Export is in the paid tier (§12) while Settings says "it's your file". Paywalling someone's own diary is ransom. (3) AI runs on Opus with no free-tier cap defined, and Ask costs up to ~$1 per question.
**Why it matters:** The privacy stance is the product's only moat against bigger journaling apps; ads spend it.
**The fix:** Paid tier only: unlimited tidies, Ask, and audio retention. Free: capture, journal, export, and 10 tidies a month. No ads. Put tidy on Sonnet at low effort and measure quality against Opus on 50 real transcripts before choosing. Part 8 makes the full case.
**Effort:** trivial (decision)
**Score after the fix:** 8/10

## [55] Accessibility — 4/10
**What's wrong:**
- **Screen reader:** `aria-live` on the transcript reads every interim fragment; the stage has an `aria-label` but no state (`aria-pressed` for recording).
- **Dynamic type:** every size is `px`, so the text ignores the OS font-size setting.
- **Contrast:** `.night .hint` at 0.6 opacity is ~3.4:1, which fails WCAG AA for 14 px text.
- **Motor:** tap-anywhere is excellent; the cancel target is 15 px text.
**The fix:** Move `aria-live` to a status node that announces `Recording`, `Saved`, `Stopped — tap to keep going`. Set `aria-pressed={recording}` on the stage. Convert type to `rem`, with `html { font-size: 100% }`. Set hint opacity to 0.78. Give every control a minimum 44×44 px hit area.
**Effort:** hours
**Score after the fix:** 8/10

## [52] Visual design and palette — 6/10
**What's wrong:** The night palette is right for 4am. The daylight half (9:30am, bathroom lights on) is also near-black with one lavender accent, which is close to the "near-black + one accent" tell the spec warns against, and less readable than a light page for long serif text in daylight.
**The fix:** Journal, Entry, Explore and Settings follow `prefers-color-scheme`. Light: bg `#f6f4ef`, text `#221f2e`, muted `#6b6680`, accent `#5b4fa8`. Capture stays night-only regardless of the system setting.
**Effort:** hours
**Score after the fix:** 8/10

## [53] Typography — 6/10
**What's wrong:** Newsreader loads via a render-blocking `<link>` to Google Fonts. On weak signal, first paint of the capture screen waits for that request to time out (see B13). Fixed px sizes (#55).
**The fix:** Self-host a Newsreader subset (Latin, weights 300/400, ~60 KB woff2) in `public/fonts/` with `font-display: swap`, and cache it in the service worker.
**Effort:** hours
**Score after the fix:** 8/10

## [54] The app's voice — 7/10
**What's wrong:** It's strong where the spec wrote it. The lapses are in the gaps I filled: `raw` (row dot), `Untidied`, `Everything has been tidied.`, `The AI declined that one.`, `The AI isn't set up on this server.`, and `Count`/`Make the index`/`Recap` on buttons.
**The fix:** Delete the first three with their features. `Couldn't tidy this one. Nothing was changed.` `Tidying isn't available right now.` One Explore button, `Look`.
**Effort:** trivial
**Score after the fix:** 8/10

## [58] Information architecture — 7/10
**What's wrong:** Capture → Journal → Entry is right. Explore as a separate top-level page for (after Part 4) two tools is too much architecture.
**The fix:** Explore becomes a single `Look back` section at the top of the Journal, collapsed by default, holding Repeats and Ask. Ask merges with search: the search field falls through to Ask when the keyword search finds nothing (`Nothing matches "late". Ask instead?`).
**Effort:** hours
**Score after the fix:** 8/10

---

## Part 3 — Broken things

Each one was reproduced in Chromium unless marked *(code)*.

| # | What breaks | How to reproduce | What it costs |
|---|---|---|---|
| B1 | **False save.** A storage write failure still plays the saved buzz and deletes the draft. | Fill localStorage (or ~1,500 dreams), record, tap to stop. Result: buzz `[30]`, `dj.entries` unchanged, `dj.draft` null. | The dream, with a success signal. The worst possible failure. |
| B2 | **Words lost on restart.** Unfinalized interim text is overwritten after the recognizer ends on a pause. | Say "i was in a red kitchen" (interim), pause until the session ends, keep talking. Draft = `and a dog came in`. | A sentence per pause, silently. Pauses are constant at 4am. |
| B3 | **Transcript freezes visually.** No autoscroll past 60vh. | Talk for ~60 words. `scrollTop 0 / scrollHeight 4031 / clientHeight 506`. | The user thinks it stopped and stops talking or taps. |
| B4 | **Hot mic off-screen.** Recording continues after tapping Journal. | Start recording, tap `Journal`. State stays `recording` on `#/journal`. | Invisible mic and wake lock; the dropout tone can fire on another screen. |
| B5 | **Asleep while recording.** Nothing ends a recording. | Start recording, stop talking, wait. *(code: no silence timeout)* | Screen lit all night, battery drained, ambient noise in the draft, entry unsaved. |
| B6 | **Silent alarm.** With Sounds off, dropout produces zero vibration. | Sounds off → start → kill recognizer. Banner shown, `vibrations: []`. | The highest-value alert is silent for anyone who turned sounds off to spare a partner. |
| B7 | **Deaf mic undetected.** A running recognizer that hears nothing never trips the watchdog. | Start, produce no results for 5 s. State stays `recording`; stop saves nothing and plays nothing. | Two minutes of talking into nothing, no feedback either way. |
| B8 | **Typing trap.** `audio-capture` / permission error locks voice off for the session. | Trigger `audio-capture` (mic in use). *(code: no path back; iOS lacks permission `onchange`)* | Voice-first app becomes a typing app until reload, with wrong instructions. |
| B9 | **Split drops raw text.** ≥90% coverage passes; a 5th dream is truncated; fallback duplicates the full raw into every piece. | Model returns 5 dreams with a short 5th; or unfaithful slices, then "Tidy again" on piece 2. *(code; unit-testable)* | Violates §5 rule 1; duplicate dreams compound per re-tidy. |
| B10 | **Edits overwritten.** "Tidy again" replaces a hand-edited `polished`. | Edit tidied text, tap Tidy again. *(code)* | The user's own writing, silently. |
| B11 | **Ask/Repeats see only 400 dreams.** Server `MAX_DREAMS = 400`, client unaware. | Have 401+ dreams; ask about the oldest. *(code)* | False "No dreams matched". |
| B12 | **Erase doesn't erase.** A joined device re-uploads; local-only leaves the server copy. | Join device B, erase on A, open B. *(code)* | The privacy promise in the copy is false. |
| B13 | **4am launch blocked on network.** Render-blocking Google Fonts `<link>` plus a network-first service worker. | Throttle to "lie-fi" (connected, ~0 throughput), open the app. *(code)* | The capture screen can't paint until requests time out, eating seconds from the 90-second window. |
| B14 | **Double-tap = nothing.** Start and stop in one motion, silent. | `dblclick` on the stage → state `idle`, no entry, no sound after the start buzz. | An accidental double-tap or stray touch ends capture. |
| B15 | **Dimmer jumps on tap.** | Tap once at (100, 29): overlay jumps from 0 to 0.54. | Sudden brightness change in the dark, or a black screen. |
| B16 | **Open AI endpoint.** `/api/ai` has no auth or rate limit. *(code)* | `curl -X POST /api/ai` in a loop. | Anyone who finds the URL spends your Opus budget. |
| B17 | **Endless spinner.** No client timeout; SDK default 10 min × 3 attempts. *(code)* | Hang the upstream. | `Tidying…` for up to ~30 minutes. |
| B18 | **Draft can't be saved directly.** Restored draft requires reopening the mic. | Kill the tab mid-recording, reopen, try to save without talking. | The start tone and hot mic just to save text already captured. |
| B19 | **Search focus lost.** Sync re-renders the Journal mid-typing. | Type in search while a push returns changes. *(code)* | Minor. Retype. |

I didn't rule these out by reasoning alone; B1–B4, B6, B7, B14 and B15 each failed against the running app.

---

## Part 4 — Delete list

1. **Image prompt generation (§8).** It doesn't help capture, and it doesn't help anyone return to what they captured; it produces a third artifact nobody asked for. The spec already concedes the output is usually wrong. Cutting it removes a model call per press, a section on every entry, the `imgPrompt` field, a prompt to maintain, and the only feature a skeptic would call gimmicky. **Gain:** an entry page that is just the dream, and a product claim ("we don't generate things about your dreams") that's cleaner than the current "we generate a prompt so someone else can".
2. **Explore: This month (§7).** A summary of text the user can read faster themselves. **Gain:** one fewer model call and one fewer place for interpretation to creep in; the Month prompt is already the one that invites pattern-making.
3. **Word count and the `raw` status dot.** Neither is information anyone acts on. **Gain:** cleaner rows; the vocabulary of the app stops including developer terms.
4. **The "Untidied" filter and its empty state.** Tidying is optional; a filter for untidied entries turns it into a to-do list, the software equivalent of a streak. **Gain:** filter row drops to three.
5. **The dimmer slider on the capture screen.** It's the most prominent control on the 4am screen and the one most likely to be hit by accident (B15). It becomes a set-once option in Settings. **Gain:** the capture screen's top bar holds `Journal` and nothing else.
6. **Fold, don't keep:** *Who and where* becomes two sections of Repeats; *Explore* stops being a destination and becomes a section of the Journal (#58). The note field stays but gets one job (#26).

---

## Part 5 — Gaps

**Gap 1 — Silence auto-save. Need: 9/10.**
The thesis says the user falls back asleep within two minutes. The app's only way to end a recording requires them to be awake. After 45,000 ms with no new speech result (interim or final), save, play the saved tone at half gain, release the wake lock, and return to idle. The tap-to-stop stays for people who are awake enough to use it. This passes the 4am test by requiring nothing. It's also the proper answer to B5, B14 and half of #10.

**Gap 2 — Keep the audio. Need: 9/10.**
Spec §11 decides this for native; it belongs at the top of the native list, not fifth. Mumbled 4am speech is the worst input speech recognition gets, and the transcript is currently the *only* copy of the dream. When recognition mangles "jet ski" into "jet sky" or drops a clause, nothing can recover it. On web, `MediaRecorder` on the same `getUserMedia` stream works in Chrome desktop and Android. Store Opus audio at 24 kbps (~180 KB/minute) in IndexedDB, with a play button on the entry. Zero interaction at 4am.

**Gap 3 — A rehearsal in onboarding. Need: 7/10.**
Replace mic priming with one live run: `Try it once. Tap the screen, say "a blue door", tap again.` Show the transcript and play the saved tone. This teaches the gesture physically, tests permission, recognizer, network and speaker volume in daylight, and makes the first 4am use the second use. On failure, show the exact reason.

**Gap 4 — "Saved · 4:14am" on the idle screen. Need: 5/10.**
After a save, the idle screen shows the time of the last save at hint luminance until the next recording. It answers "did that work?" for someone who half-opens their eyes, without making them read more than one short line.

---

## Part 6 — The tidy prompt, line by line

### What each instruction actually does

| Line | Verdict |
|---|---|
| "You tidy up dream-journal voice transcripts… fragmented, out of order, repetitive and unpunctuated." | **Load-bearing.** Sets expectations so the model doesn't treat mess as intent. Missing one fact: the text came from a *speech recognizer*, so it contains misheard words, not just messy ones. |
| "FIRST decide how many separate dreams are in here." | **Load-bearing.** Ordering helps. |
| "People often say 'then I had another dream'… split there. Only split when they clearly signal a separate dream." | **Load-bearing, incomplete.** No guard for mentions of *other nights'* dreams ("I've had this dream before", "like the one last week"), which contain the same trigger phrases. |
| "A scene change inside one dream is NOT a split; dreams jump around on their own." | **Load-bearing, incomplete.** Doesn't cover the most common false boundary in dream reports: the false awakening ("and then I woke up, but I was still in the house"). "I woke up" is the strongest split signal a model will see, and it's wrong here. |
| "rewrite it as readable first-person present-tense prose" | **Wrong.** Converting tense is authorship. It contradicts "Keep their vocabulary" and "You're a typist". Many people tell dreams in the past tense; the app would rewrite every one of them. |
| "Keep every image, person, place, name, action and feeling. Invent nothing." | **Load-bearing.** Keep. |
| "Add no meaning, symbolism, tidy ending, or interpretation. You're a typist, not an author." | **Load-bearing.** The best line in the product. Keep verbatim. |
| "Keep their uncertainty." | **Load-bearing.** Keep. |
| "Cut filler, stammers, false starts, repeats." | **Half wrong.** "Repeats" will cut repetition that *is* the dream ("the door kept opening, and opening, and opening"). Must distinguish speech repetition from dream repetition. |
| "If they corrected themselves, keep only the correction." | **Wrong for dreams.** Dreams shape-shift: "it was my mom, no, it was my teacher" is often a report that the person changed. The rule deletes dream content. It needs a split between slips of the tongue and changes in the dream. |
| "Keep their vocabulary. Don't upgrade their words." | **Load-bearing.** Keep. |
| "leave the fragment in [brackets]" | **Load-bearing.** Keep. |
| "Reply with only JSON: {…}" | **Decorative now.** Structured output enforces the shape. The *field descriptions* inside it do the real work. |
| "title": "3-6 concrete words from that dream's own images" | **Load-bearing, incomplete.** Models drift toward headlines ("Lost in the Endless Hallway"). Needs "a label, not a headline" and "no feelings or ideas the dream didn't state". |
| "transcript": "the verbatim slice…" | **Unreliable by design.** Models paraphrase, normalize and skip while "copying" long spans; the 90% guard exists because this fails. Replace with short start anchors, and cut in code. |
| "Usually one dream. Never more than four." | **Load-bearing,** but says nothing about what to do with a fifth. The code truncates it (B9). |

**Missing entirely:** misheard-word policy; removing recording chatter ("okay it's on", "what time is it"); a no-dream case ("I don't remember anything"); an explicit rule not to sanitize sex, violence or swearing, which models soften by default and §9.2 says is normal content.

### Transcripts that break the current prompt

1. `i was at my grandmas and then i woke up and i was in my bed but the bed was floating on a lake` → false awakening; likely split into two dreams.
2. `this is like the dream i had last week where my teeth fall out anyway so my teeth were loose` → "the dream I had last week" read as a boundary.
3. `we were in paris no wait it turned into london and the eiffel tower was in the thames` → the correction rule deletes Paris, which is the point of the dream.
4. `the door kept opening and opening and opening and every time there was the same man` → "cut repeats" gives "the door kept opening".
5. `okay um is it recording okay uh there was a horse in the kitchen` → "Is it recording?" survives as dream text, or worse, becomes "I ask if it's recording."
6. `i was swimming in the see with my sister and she was um she was naked and so was i and it wasnt weird` → "see" stays wrong; the nudity is at risk of being softened to "we were swimming".
7. `i dont really remember anything just a feeling` → the model invents a dream-shaped paragraph to satisfy the schema.
8. Five clearly signalled dreams → the 5th is dropped by the code.

### Rewritten tidy prompt (full)

```
You're tidying a dream-journal voice transcript. Someone spoke it into their phone
seconds after waking, half asleep, and a speech recognizer turned it into text.
Expect fragments, things out of order, repetition, no punctuation, and some
misheard words.

STEP 1 — HOW MANY DREAMS
Split only where the speaker clearly says a new, separate dream is starting
("then I had another dream", "in a different dream", "the other one was").
Do NOT split for:
- scene changes, time jumps or teleporting inside one dream;
- waking up inside the dream and carrying on — a false awakening is part of the
  same dream;
- mentions of dreams from other nights ("I've had this one before", "like last
  week's").
Almost every transcript is one dream. If there seem to be more than four, put
everything from the fourth onward into the fourth.
If there is no dream content at all ("I don't remember anything"), return an
empty list.

STEP 2 — WRITE EACH DREAM OUT
You're a typist, not an author.
- Keep every image, person, place, name, object, action and feeling. Add nothing.
- Keep their tense and their point of view. If they switch tenses, use the one
  they used most.
- Keep their words. Don't upgrade their vocabulary, and don't smooth over odd
  phrasing that describes something odd.
- Keep uncertainty exactly as hedged. "I think it was my mom, maybe" stays hedged.
- Remove only speech noise: ums, stammers, false starts, words said twice by
  accident, and remarks about the recording itself ("okay it's recording",
  "what time is it").
- Repetition that happened in the dream stays ("the door kept opening, again and
  again").
- If they fixed a slip of the tongue, keep the fix. If the dream itself changed
  ("it was Paris, then it was London"; "it was my mom, but also my teacher"),
  keep both.
- Fix a misheard word only when the intended word is obvious from the sentence
  ("swimming in the see" → "sea"). Otherwise leave it as heard.
- If a stretch is too garbled to be sure of, keep it in [brackets] rather than
  guessing.
- Don't soften, censor or leave out anything — sex, violence, swearing and
  embarrassing details stay exactly as said.
- Add no meaning, symbolism, conclusion or tidy ending.
- Punctuate, and break into short paragraphs where the dream moves on.

For each dream also give:
- title: 3–6 plain words naming things that are in that dream ("Jet ski with
  Dad", "Flooded school hallway"). A label, not a headline — no feelings or ideas
  the dream didn't state.
- starts_with: the first 6–10 words of where this dream begins, copied exactly as
  they appear in the transcript, typos and all. For the first dream, the
  transcript's first words.
```

Schema: `{dreams: [{title, text, starts_with}]}`. Code cuts `raw` at each `starts_with` (normalized `indexOf` after the previous anchor), so the pieces tile the transcript exactly. On any missing anchor, don't split.

### The Explore prompts, briefly

- **Shared rule.** Keep verbatim. It's the second-best text in the product.
- **Repeats.** "Count the dreams each one appears in" hands arithmetic to the model. → Return `dream_ids` per item and count in code. "weather, colours" → remove colours as standalone items ("blue" isn't a repeat; "the blue door" is). Add: "Skip things too ordinary to notice: walking, talking, a room, a house, people in general." "At most eight" is good; keep it.
- **Who and where.** Fold into Repeats' output as `people` and `places`, each with `dream_ids`. "Unnamed strangers only count if described specifically enough to recognise" is load-bearing; keep it.
- **This month.** Deleted (Part 4). If kept: remove "anything that came up more than once" (it's pattern-finding in a recap's clothes) and "like a librarian describing a shelf" (decorative).
- **Ask.** Change "quoting or closely paraphrasing" to "quoting exactly, 5–15 words", so the code can verify the quote exists in that dream and drop invented hits.

---

## Part 7 — Top 10 actions

1. Make `saveDraftAsEntry` verify the write landed before playing the saved tone or deleting the draft, and play the dropout tone plus keep the draft on failure (B1).
2. In `rec.onend`, fold `cap.interim` into `cap.finalText` and persist before restarting (B2).
3. Autoscroll `#transcript` to the bottom on every paint, and cap it at the last four lines (B3).
4. Make the dropout alert always vibrate, independent of the Sounds toggle (B6).
5. Hide `Journal` and the dimmer while recording, save-and-stop if the route leaves capture, and ignore stop taps within 1,200 ms of start (B4, B14, B15).
6. Add deaf-mic detection: 8,000 ms of recording with zero results fires the dropout path with `Not hearing anything. Tap to try again.` (B7).
7. Add silence auto-save at 45,000 ms with no new results, releasing the wake lock (Gap 1, B5).
8. Self-host Newsreader and make the service worker cache-first for the app shell, so capture paints with no network (B13).
9. Replace verbatim transcript slices with `starts_with` anchors cut in code, store the untouched original in `source`, and make "Tidy again" two-tap when `polished` was hand-edited (B9, B10).
10. Delete image prompts, This month, word count, the `raw` dot and the Untidied filter (Part 4).

After these: IndexedDB storage (#40), then the onboarding rehearsal (Gap 3).

---

## Part 8 — The argument I want to make

**Ads should be struck from §12 entirely.** The app's whole trust position is in its own copy: "There's no account and nothing posted anywhere." An ad slot, even at the bottom of the list, means a third-party SDK running inside the journal, reading device identifiers and reporting sessions from inside a diary that §9.2 correctly expects to hold sex dreams. No placement rule fixes that, because the problem isn't where the ad is drawn; it's that the ad network is in the process at all. The alternative costs little: a paid tier at a few dollars a month for unlimited tidies, Ask and audio retention, with capture, journal and export free forever. Paywalling export (§12) should go with it. A product that says "it's your file" can't then charge to hand it over.

**§3.1's "tap again → saves" should not be the primary way a recording ends.** The spec's own scenario says the user will fall asleep within two minutes whether or not the dream is saved. A design that needs a second deliberate action from that person will fail in exactly the cases it exists for. Silence should end the recording; the tap is an early exit.

**The Apple Watch rejection (§2, §11) is the one non-goal I'd reopen.** The Watch is the best capture device ever made for this thesis. It's already on the wrist, it wakes with a wrist raise, its screen doesn't light the room, it needs no unlock, and its haptics are felt with eyes closed, which fixes the silent-switch problem on the phone. "Log a dream" on the Watch is a single raise-and-talk with the phone never touched. It's also small in scope: record audio, send it to the phone, one complication. It was cut as "too much app"; it's the least app of any capture path. Build it right after the Action Button.
