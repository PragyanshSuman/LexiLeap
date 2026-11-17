# LexiLeap design rules

LexiLeap is used by dyslexic children aged 4–10, often with a parent, teacher or therapist beside them. Every
screen follows the rules below so a child learns the controls once and can then spend their effort on reading,
not on working out the interface. New screens should be built only from the shared components listed here.

## Why these rules

The rules follow published guidance on dyslexia-friendly design, chiefly the British Dyslexia Association's
*Dyslexia Style Guide* (2023), the W3C *Making Content Usable for People with Cognitive and Learning
Disabilities* (COGA, 2021), and studies of reading with dyslexia, for example Rello & Baeza-Yates (2013) on fonts
and Zorzi et al. (2012, *PNAS*) on letter spacing. In short:

| Guidance | How LexiLeap applies it |
| --- | --- |
| Plain, evenly spaced sans-serif text; larger sizes; extra letter, word and line spacing | `AppText` uses the child's chosen font (Lexend, OpenDyslexic, Atkinson Hyperlegible), text size and spacing; line height ≥ 1.5 (≥ 1.6 for Tamil and Hindi) |
| Avoid capitals for whole words, italics and underlining | Sentence case everywhere, including section headers that were in capitals in the original app; no italics or underlining |
| Left-aligned paragraphs; short sentences | Explanations are left-aligned (`ScreenIntro`); only short titles and labels are centred |
| Soft, off-white backgrounds instead of pure white; no pure black text | Four low-glare themes; every surface and text colour comes from the theme, so the dark "dusk" theme works on every screen |
| Don't rely on colour alone | Answer states add a ✓ / ↻ badge and a thicker border; banners have an icon |
| Give information in more than one way | Every prompt can be heard (🔊); instructions are read aloud; icons sit beside words on buttons |
| Predictable, consistent layout | The same header, the same button styles and the same main-action position on every screen |
| Avoid time pressure and harsh failure messages | No visible countdowns or stopwatches for the child (times are recorded for grown-ups only); mistakes are amber "let's try again", never red; struggle and low focus lead to a calm break or an easier level |

## Screen layout

- **Header**: back on the left, title and a short subtitle, an optional ⓘ tour button on the right.
  Activities use the runner's top bar instead: ✕ to stop, progress, and 🔊 to hear the prompt again.
- **Content** in the middle, at most 720 pt wide (centred on tablets).
- **Main action at the bottom** (`Screen` `footer`), within thumb reach. When there are two actions, the secondary
  one is on the left and the main one on the right.

## Components (`src/ui/`)

| Use | Component | Rules |
| --- | --- | --- |
| Any text | `AppText` | Never hard-code colours that ignore the theme; use `muted` for secondary text |
| Text buttons | `Button` | `primary`: one main action per screen. `secondary`: other actions (outlined). `ghost`: quiet actions such as Skip. Always an icon plus a short label; labels wrap rather than being cut; 60 pt tall (48 pt `compact`) |
| Icon-only buttons | `IconButton` | Close, settings, back/next arrows; always a spoken `label` |
| Hear something | `SoundButton` | The same round speaker everywhere, with its label underneath |
| Say something | `MicButton` | The same big microphone everywhere; red ring and "Listening…" while recording |
| Answer choices | `AnswerTile` | Correct = green + ✓; wrong = amber + ↻ and a small wiggle (none with calm motion) |
| How did I do? | `FeedbackBanner` | `correct`, `tryAgain`, `info`; one kind sentence plus an optional detail line |
| Test or studio intro | `ScreenIntro` | Big emoji, title, left-aligned explanation |
| Numbers | `StatTile` | Value over a short label |
| Typing | `TextField` | Large, theme-coloured, in the reading font |

## Colour

- **Accent colour = the feature's tile colour on Home.** Every primary button, speaker and microphone on that
  screen uses it; activities pass it to their rounds as `accent`. `Button` derives the gradient and picks
  readable text (warm off-white or near-black) automatically.
- Status colours come from the theme: `success` for right, `warning` (amber) for "try again", `primary` for hints.
  `danger` (red) is only for destructive actions in the parent zone.

## Motion and sound

- Spring press on every button (`PressableScale`), gentle entrances (`FadeInUp`, `PopIn`, `Bob`).
  All of it turns off with the child's *calm motion* setting or the system's reduce-motion setting.
- Each tap gives a soft sound and haptic (if switched on); correct and try-again sounds are distinct.
