# Restoring the UnifiedLearningApp experience

Decision (Oct 30, 2026): LexiLeap keeps its clean architecture and on-device engine, but must **look and
animate like UnifiedLearningApp** and **include every feature it had**, running fully on the device (no
Python server). Work proceeds in phases. Each phase must pass `npm run typecheck`, `npm run lint`,
`npm test` and an iOS + Android `expo export` before it is marked done.

| # | Phase | Scope | Status |
| --- | --- | --- | --- |
| 1 | Look & navigation | Original DyslexiaTheme palette, gradient cards, original Home layout (DysPath hero banner; Daily Learning / Games & Play / My Progress / Clinical Tools sections), side drawer (profile header, language chips, ruler, colour overlay, animations, sound, logout), spring-press animations, tablet landscape | Done |
| 2 | Accounts & languages | Local username/password accounts (salted hash, on-device) with Login/Register screens like the original — **done**; English, Tamil, Hindi UI (typed dictionaries, script-aware text, localized voice prompts) — **done** | Done |
| 3 | Learning Path | DysPath map (units → nodes, XP, unlocking, spaced review), AI Roadmap controller, Adaptive Pathing modal, Wellness Advisor modal, Feature Tour | Done |
| 4 | Games | Word Ninja (swipe to slice), Letter Sorting (drag to monsters), original Rhyme matching and Odd One Out, bee & honey letter tracing with letter menu, guided / memory tracing and tracing report | Done |
| 5 | Speech | Phonic Check studio with on-device pronunciation scoring, Clinical speech assessment + medical-style report, Magic Words phoneme studio (CMU dictionary) | Done |
| 6 | Writing | Write & Score letter challenge and the Write Test (listen & write, letter by letter, grown-up review, spelling report) with on-device handwriting recognition from the original 62-class EMNIST model, including mirror/upside-down reversal checks (pure-TypeScript inference, so it also runs in Expo Go) | Done (about 0.5–2 s per letter on a Xiaomi Pad 6) |
| 7 | Camera | Focus helper: opt-in, on-device attention and expression signals (development build: camera + ML Kit face detection; graceful fallback in Expo Go) feeding the AI Roadmap; Mood Track and My Report screens; focus in the PDF report | Done (to confirm on a device with a development build) |

Notes
- Camera tracking needs native modules, so it only works in a development build, not Expo Go.
- The original handwriting model was trained on raw torchvision EMNIST, whose images are stored
  transposed; the original app fed it upright canvas images, which is why its handwriting checks were
  unreliable. LexiLeap transposes the canvas image first (`src/handwriting/raster.ts`).
- The original model read only about 58% of finger-drawn letters (91% of scanned ones) and caught few
  reversals. It is now fine-tuned on canvas-style redraws: 92.7% read correctly, 86% of mirrored and 83% of
  upside-down letters caught, 1.1% false alarms. Full method and numbers in `docs/HANDWRITING_METRICS.md`.
- A 4× lighter distilled student (`scripts/train-handwriting-student.py`) read about 3% fewer letters, and the
  full model is fast enough on the tablet (about 0.5 s per letter), so the full model is shipped.
- Next for the research study: re-measure with children's own consented, adult-labelled letters. Only results
  are logged today, so this needs an opt-in export of the drawn strokes.
- `@react-native-ml-kit/face-detection` is listed as untested on React Native's New Architecture (it uses the
  legacy module interop). It is excluded from expo-doctor's directory check for that reason only. The app
  loads it lazily and catches every failure, so if it misbehaves the Focus helper just reports itself
  unavailable. Check it on a development build on both platforms before relying on focus data.
- The original speech/face analysis ran on a Python server. The Focus helper replaces it with on-device
  signals (head angle, eye openness, smile) and keeps no photos.
- Original assets (letter images, bee/honey artwork, CMU dictionary, EMNIST model) are reused from
  `../UnifiedLearningApp` where they exist.
