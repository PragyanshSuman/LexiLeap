# LexiLeap

A dyslexia-friendly literacy app for children aged 4–10, for **iOS and Android** (Expo SDK 58 / React Native).
It is a clean rebuild of `UnifiedLearningApp`: the same look, animations and features, with a structured
codebase, and **everything runs on the device**. There is no Python server to start, nothing hard-coded to a
LAN address, and no photo or recording ever leaves the phone.

## What's inside

**Look & feel**: the original DyslexiaTheme palette, gradient cards and spring animations; the DysPath hero
banner; a side drawer with profile, language chips, reading ruler, colour overlay, animation and sound switches.
Phones stay in portrait; tablets rotate freely.

**Accounts & languages**: child logins with username and password (salted SHA-256, on the device), a
PIN-protected parent zone, and the whole child interface in **English, Tamil and Hindi**, with voice prompts in
the chosen language when the device has a voice for it.

**Learning Path (DysPath)**: 4 units, 20 nodes, XP and levels, spaced review, an AI Roadmap that suggests the next
node, the Adaptive Pathing sheet when a child struggles, the Wellness Advisor for breaks, and feature tours.

**12 activities**, each with 3 adaptive levels: Letter Trace (bee & honey, guided and memory tracing), Sound
Match, Say It, Odd One Out, Letter Sorting (drag to the monsters), Letter Hunt, Memory Lights, Rhyme Time (MC Frog),
Clap the Beats, Sound Boxes, Word Ninja (swipe to slice) and Word Builder, plus **Spot It** (visual discrimination).

**Speech tools** (on-device pronunciation scoring with the CMU dictionary, ~117k words):
- **Say It Right**: say a word and see which sounds were right, missed or swapped.
- **Magic Words**: type or say any word to see it split into colour-coded sounds and hear it.
- **Speech Test** (Clinical Tools): 20 words covering every English sound, scored sound by sound, or marked by an
  adult when the device can't listen. It saves a medical-style PDF report.

**Writing tools** (on-device handwriting recognition, see [Models](#on-device-models)):
- **Write & Score**: hear a letter, write it, and the app reads it, warning about mirrored or upside-down letters.
- **Write Test** (Clinical Tools): hear 10 words (easy to tricky) and write them letter by letter. A grown-up can
  correct any misread letter. The app then classifies reversals, swaps, omissions, insertions and substitutions
  with the original thresholds and practice tips, and saves a PDF report.

**Focus helper** (opt-in, per child): during activities the front camera takes a small photo every 5 seconds.
ML Kit checks it on the device, the photo is deleted straight away, and only "happy / focused / tired / looking
away" and a 0–100 focus score are kept. Several low readings in a row open the AI Roadmap. The **Mood Track**
and **My Report** screens show focus per activity, a 14-day concentration heatmap and a learning profile.

**Parent zone**: weekly summary, the day's plan and its reasoning, skills, levels, A–Z tracing map, look-alike
mix-ups (b↔d, was↔saw), speech and writing tests, wellbeing, a shareable PDF report, screen-time limits, break
reminders, password reset, backup and restore, and data erase.

**Designed for dyslexic readers**: one consistent set of controls on every screen, sentence case (no capitals),
left-aligned explanations, low-glare themes with AA contrast, icons beside every label, everything can be heard,
no visible timers, and gentle amber "try again" feedback instead of red. See [docs/DESIGN.md](docs/DESIGN.md).

## Expo Go or a development build

| Feature | Expo Go | Development / store build |
| --- | --- | --- |
| Everything not listed below, including handwriting | ✅ | ✅ |
| Live speech checking (Say It, Say It Right, Speech Test) | Adult-marked fallback | ✅ |
| Focus helper (camera + ML Kit) | Shows "needs the full app" | ✅ |

```bash
npm install
npx expo start                     # scan the QR code with the Expo Go app (not the camera app)

# Development build (speech recognition + Focus helper):
npx eas-cli@latest build --profile development --platform android   # or ios
# or locally: npx expo run:android / npx expo run:ios (macOS + Xcode)
```

Release builds: `npx eas-cli@latest build --profile production --platform all`, then `eas submit`.
Bundle identifiers are `com.lexileap.app`; change them in `app.json` before publishing. Native folders are
generated (Continuous Native Generation), so configure native behaviour through `app.json` and config plugins.

## Quality checks

```bash
npm run typecheck   # TypeScript, strict
npm run lint        # ESLint (Expo config, including React Compiler rules)
npm test            # Jest: engine, content, generators, handwriting model, every activity and screen flow
npm run doctor      # expo-doctor dependency and config checks
```

## On-device models

- **Pronunciation**: the CMU Pronouncing Dictionary (`assets/data/cmudict.txt`, built by
  `scripts/build-dictionary.py`), loaded lazily, with rule-based fallback for unknown words. Spoken words are
  aligned sound by sound with edit distance (`src/speech/phonemes.ts`).
- **Handwriting**: the original "Micro-Dyslexia-CNN-62" (EMNIST ByClass, 62 classes, with orientation and risk
  heads), fine-tuned on letters redrawn the way a finger draws on the canvas (`scripts/finetune-handwriting.py`).
  It runs in plain TypeScript (`src/handwriting/`), so it needs no native code and works in Expo Go. Batch norm
  is folded into the convolutions and weights are stored as int8 (`assets/models/handwriting.bin`, made by
  `scripts/export-handwriting-model.py`); a test checks the TypeScript output against the Python reference.
  The canvas is cropped, centred and transposed to match EMNIST's stored layout. On finger-drawn letters it reads
  92.7% correctly and catches 86% of mirrored and 83% of upside-down letters with 1.1% false alarms; see
  [docs/HANDWRITING_METRICS.md](docs/HANDWRITING_METRICS.md).
- **Focus**: Google ML Kit face detection (`@react-native-ml-kit/face-detection`), loaded only when present.

## Project structure

```
src/
  app/                  Expo Router screens (file = route)
    (child)/            Drawer screens: Home, Play, Rewards, Reading comfort
    activity/[id].tsx   Runs any activity          path/        Learning Path map and node briefings
    assessment/         Speech Test, Write Test    parent/      PIN-protected parent zone
    writing, phonic-check, magic, visual, mood-track, journey   Studios and reports
  activities/           One file per activity; ActivityRunner (rounds, retries, struggle and focus breaks)
  engine/               Pure logic: catalog, levels, plan, path, badges, assessment, spelling, focus
  handwriting/          Model inference, EMNIST-style rasteriser, letter recognition and reversal checks
  speech/               ARPAbet sounds, alignment, spelling chunks
  services/             Voice, sounds, speech recognition, dictionary, handwriting model, face detection, PDF, backup
  components/           Shared pieces: writing pad, focus tracker, sheets, tours, pronunciation card
  store/                Persisted state (zustand + AsyncStorage), profiles, parent session, backup format
  i18n/                 Typed dictionaries (en, ta, hi)
  theme/, ui/, hooks/   DyslexiaTheme, palettes, fonts, shared UI, hooks
scripts/                Asset builders: dictionary, handwriting model export, icons, sounds, artwork
docs/ROADMAP.md         How the original app's features were restored, phase by phase
docs/DESIGN.md          Dyslexia-friendly design rules, their evidence, and the shared UI components
```

### Extending

- **Add words**: edit `src/content/*.ts`; every picture word needs an emoji in `PICTURES` (tests enforce it).
- **Add an activity**: metadata in `engine/catalog.ts`, a generator in `activities/generators.ts`, a round component
  with an `ActivityDefinition`, then register it in `activities/registry.ts`. The runner, plan, path, badges,
  Focus helper and reports pick it up automatically.
- **Add a language**: add a dictionary next to `src/i18n/en.ts`; the `Dictionary` type makes TypeScript list any
  missing string.

## Privacy

No ads, analytics or cloud accounts; logins and progress stay on the device. The camera is used only when a
parent turns on the Focus helper; photos are checked on the device and deleted immediately. Speech checking uses
the platform recogniser (on some devices processed by Apple or Google); LexiLeap stores no audio. Reports are
shared only when a parent chooses to. Unneeded Android storage permissions are blocked.

LexiLeap is a practice and screening aid, not a diagnostic test.
