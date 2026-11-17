# LexiLeap

A dyslexia-friendly literacy app for children aged 4–10, for **iOS and Android** (Expo SDK 58 / React Native).
It is a clean rebuild of `UnifiedLearningApp`: the same look, animations and features, with a structured
codebase, and **everything runs on the device**. There is no Python server to start, nothing hard-coded to a
LAN address, and no photo or recording ever leaves the phone.

## What's inside

**Look & feel**: the original DyslexiaTheme palette, gradient cards and spring animations; the DysPath hero
banner; a side drawer with profile, language chips, reading ruler, colour overlay, animation and sound switches.
Phones stay in portrait; tablets (iPad included) rotate freely, and every screen, sheet and tour works in both
orientations and in iPad Split View.

**Accounts & languages**: child logins with username and password (salted SHA-256, on the device), a
PIN-protected parent zone, and the whole child interface in **English, Tamil and Hindi**, with voice prompts in
the chosen language when the device has a voice for it.

**Learning Path (DysPath)**: 4 units, 22 nodes, XP and levels, spaced review, an AI Roadmap that suggests the next
node, the Adaptive Pathing sheet when a child struggles, the Wellness Advisor for breaks, and feature tours.

**14 activities**, each with 3 adaptive levels: Letter Trace, Sound Match, Say It, Odd One Out, Letter Sorting
(drag to the monsters), Letter Hunt, Memory Lights, Rhyme Time (MC Frog), **Rhyme Train**, **Voice Vault**, Clap the
Beats, Sound Boxes, Word Ninja (swipe to slice) and Word Builder, plus **Spot It** (visual discrimination).

**Letter tracing** looks exactly like the original app: the sky-blue *Alphabet Playground*, the picture-tile
*Choose a Letter* menu, and the guided tracer with drifting colour orbs, the tiger, glowing guide dots, the yellow
puck with its direction arrow, sparkles, an end-of-letter replay (the letter writes itself again stroke by
stroke in glossy ink behind a glowing pen tip, then shines) and the A–Z strip. Small letters (a–z) work the same way. Learning Path and daily-plan tracing use the same tracer (capitals and small
letters, with faded memory tracing at level 3). Free tracing is saved as tracing sessions (5 letters each), so it
counts for stars, levels, the A–Z map, the plan and the path.

**Rhyme Time** has the original three modes, all playable: *Make a Match*, *Rhyme Train* (load every carriage that
rhymes with the engine's word) and *Voice Vault* (say a rhyme out loud; it is checked on the device with the CMU
dictionary and locked in the child's vault, or marked by a grown-up when the device can't listen).

**Speech tools** (on-device pronunciation scoring with the CMU dictionary, ~117k words; words are matched by
sound as well as spelling, so homophones like sun/son count; every spoken answer is scored phoneme by phoneme):
- **Say It Right**: say a word and see which sounds were right, missed or swapped.
- **Magic Words**: type or say any word, or tap one of the *Words for you* at the child's level (the original's
  Adaptive Journey), to see it split into colour-coded sounds and hear it.
- **Speech Test** (Clinical Tools): 20 words covering every English sound, scored sound by sound, or marked by an
  adult when the device can't listen. It saves a medical-style PDF report.

**Writing tools** (on-device handwriting recognition, see [Models](#on-device-models)):
- **Letter Mastery** (Write & Score), exactly as in the original app: A–Z cards with each letter's progress,
  search, the dark writing board with clear / watch / hear / check buttons and the A–Z strip, and the "Watch
  carefully!" demo. Checking a letter runs the original kinematics analysis (motion, smoothness, tremor, shape,
  stroke order and direction, orientation) and the handwriting model, then shows the full results page, a Session
  Report and a Progress Dashboard (trend, letter status, screening indicators), all from the child's own writing.
- **Write Test** (Clinical Tools): hear 10 words (easy to tricky) and write them letter by letter. A grown-up can
  correct any misread letter. The app then classifies reversals, swaps, omissions, insertions and substitutions
  with the original thresholds and practice tips, and saves a PDF report.

**Focus helper** (opt-in, per child): during activities the front camera takes a small photo every 5 seconds.
ML Kit finds the face (head angle, eye openness, smile) and the original app's **7-expression model** (angry,
disgust, fear, happy, sad, surprise, neutral; the same model its server used, now running on the device) reads
it; the photo is deleted straight away. Only the expression (happy, focused, surprised, frustrated, sad, worried,
tired, looking away) and a 0–100 focus score are kept. Several low readings in a row open the AI Roadmap.
**Fallbacks**, best first: camera with expressions → camera with attention only (if the expression model can't
run) → touch and speech activity (when the face is out of view, the camera is off, not allowed or failing, or the
build has no face detector, e.g. Expo Go). Each reading records its source; the badge shows 👁 or ✋, and the
parent zone, Mood Track and PDF report say which mode is in use. In the parent zone, the
**Focus & mood report** and **Learning report** show focus per activity, a 14-day concentration heatmap and a
learning profile; the child's own Mood Track shows only their mood check-ins.

**Who sees what**: children see only kind, simple feedback ("Great writing!", "All done!"). Every analysis is
for parents and clinicians, behind the parent PIN: Letter Mastery's Progress Dashboard and Session Reports, the
Speech Test and Write Test results and PDFs, the Focus & mood report and the Learning report.

**Parent zone**: weekly summary, the day's plan and its reasoning, skills, levels, A–Z tracing map, look-alike
mix-ups (b↔d, was↔saw), speech and writing tests, wellbeing, a shareable PDF report, screen-time limits, break
reminders, struggle sensitivity (how soon an easier level is offered) and a highest-level cap (the original's
"AI frustration sensitivity" and "max difficulty ceiling"), password reset, backup and restore, and data erase.

**Designed for dyslexic readers**: one consistent set of controls on every screen, sentence case (no capitals),
left-aligned explanations, low-glare themes with AA contrast, icons beside every label, everything can be heard,
no visible timers, and gentle amber "try again" feedback instead of red. See [docs/DESIGN.md](docs/DESIGN.md).

## Expo Go or a development build

| Feature | Expo Go | Development / store build |
| --- | --- | --- |
| Everything not listed below, including handwriting | ✅ | ✅ |
| Speech checking (Say It, Say It Right, Voice Vault, Speech Test) | Grown-up marks (Expo Go has no speech engine) | ✅ In-app microphone, on-device recogniser, phoneme scoring |
| Focus helper (camera + expressions) | ✅ Face found in JavaScript (OpenCV cascade) + expression model | ✅ ML Kit (adds eye openness, head turn) + expression model |

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

## Running on an iPad or tablet

- **Quick look (Expo Go)**: install Expo Go on the iPad, keep it on the same Wi-Fi as the computer, run
  `npx expo start` and scan the QR code with the iPad's Camera app. Speech checking and the camera Focus helper
  use their fallbacks (a grown-up marks spoken answers; focus comes from touch activity).
- **Full app over USB (macOS)**: install Xcode, add your Apple ID in Xcode → Settings → Accounts, turn on
  Developer Mode on the iPad, then `npx expo install --fix && npx expo run:ios --device`. With a free Apple ID
  the app must be reinstalled every 7 days.
- **Installed app that keeps working (needs the $99/year Apple Developer Program)**: `npx eas-cli@latest login`,
  `npx eas-cli@latest init`, set your own `ios.bundleIdentifier` in `app.json`, register the iPad with
  `npx eas-cli@latest device:create`, then `npx eas-cli@latest build --profile preview --platform ios` and open
  the install link on the iPad. It works offline for up to a year.
- **Android tablets**: `npx eas-cli@latest build --profile preview --platform android` makes an APK (no paid
  account needed).

## Quality checks

```bash
npm run typecheck   # TypeScript, strict
npm run lint        # ESLint (Expo config, including React Compiler rules)
npm test            # Jest: engine, content, generators, handwriting model, every activity and screen flow
npm run doctor      # expo-doctor dependency and config checks
npm run check       # typecheck + lint + tests in one go
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
- **Faces without ML Kit**: OpenCV's frontal-face Haar cascade (the default detector of the original's `fer`
  package), run in TypeScript (`src/emotion/faceDetector.ts`, `assets/models/face.bin`, made by
  `scripts/export-face-cascade.py`; a test checks it finds exactly the faces OpenCV finds). Licence:
  `assets/models/OPENCV-LICENSE.txt`.
- **Focus**: Google ML Kit face detection (`@react-native-ml-kit/face-detection`), loaded only when present, and the
  original app's facial-expression model (mini-XCEPTION trained on FER-2013, from the MIT-licensed `fer` package;
  model by O. Arriaga) in plain TypeScript (`src/emotion/`, `assets/models/emotion.bin`, made by
  `scripts/export-emotion-model.py`; a test checks it against Keras). The face is cropped and shrunk to 64×64 with
  `expo-image-manipulator` and decoded with `jpeg-js`. On FER-2013 this model is about 66% accurate on adult faces
  and less sure on children's, so expressions are shown as gentle signals, never as a diagnosis.

## Project structure

```
src/
  app/                  Expo Router screens (file = route)
    (child)/            Drawer screens: Home, Play, Rewards, Reading comfort
    activity/[id].tsx   Runs any activity          path/        Learning Path map and node briefings
    assessment/         Speech Test, Write Test    parent/      PIN-protected parent zone
    tracing/, mastery/, rhyme   Letter tracing, Letter Mastery and Rhyme Time
    phonic-check, magic, visual, mood-track, journey             Studios and reports
  activities/           One file per activity; ActivityRunner (rounds, retries, struggle and focus breaks)
  engine/               Pure logic: catalog, levels, plan, path, badges, assessment, spelling, focus
  handwriting/          Model inference, EMNIST-style rasteriser, letter recognition and reversal checks
  emotion/              Facial-expression model inference and face preprocessing
  speech/               ARPAbet sounds, alignment, spelling chunks
  services/             Voice, sounds, speech recognition, dictionary, handwriting model, face detection, PDF, backup
  components/           Shared pieces: writing pad, focus tracker, sheets, tours, pronunciation card
  tracing/              The original guided tracer: letter geometry, tracer, session recorder
  writing/              Letter Mastery: letter paths, kinematics analysis, writing board, charts
  store/                Persisted state (zustand + AsyncStorage), profiles, parent session, backup format
  i18n/                 Typed dictionaries (en, ta, hi)
  theme/, ui/, hooks/   DyslexiaTheme, palettes, fonts, shared UI, hooks
scripts/                Asset builders: dictionary, handwriting and expression model export, icons, sounds
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
