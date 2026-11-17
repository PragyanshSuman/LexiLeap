# Handwriting recognition: metrics

How well LexiLeap reads a child's handwritten letter and spots reversals, measured with
`scripts/evaluate-handwriting.py`. Write & Score and the Write Test both rely on this, through `checkLetter` and
`readLetter` in `src/handwriting/recognize.ts`.

## How it is measured

- **Letters:** 2,000 random letters (capital and small) from the EMNIST ByClass *test* set. The model never saw
  them in training.
- **Finger-drawn redraws:** children write with a finger on a tablet, so strokes have even width and no pressure
  or smudges. Each scanned EMNIST letter is thinned to its centre line, then drawn again as pen strokes through
  a Python copy of the app's own pipeline (`src/handwriting/raster.ts`: crop, centre, supersample,
  transpose). It is then read by the same int8 model file the app loads (`assets/models/handwriting.bin`).
- **Decision rule:** the script uses the same rule as `checkLetter`:
  - capital/small mix-ups count only where the two look the same (c, k, o, s and so on);
  - the look-alike readings below also count;
  - the reversal rule is the same.
- **Reversals:** every letter is also mirrored, turned upside down, and rotated half a turn, then checked against
  the letter that was asked for. Letters that look the same mirrored (A, H, o…) or upside down (B, C, x…) are
  left out of those catch rates, because their reversal can't be seen.
- **Wrong letters:** each letter is also checked against a random *different* target. "Wrong letters accepted"
  is how often the app would wrongly praise it.

Run it again with:

```
python scripts/evaluate-handwriting.py ../UnifiedLearningApp/backend/ml_training 2000          # current app settings
python scripts/evaluate-handwriting.py ../UnifiedLearningApp/backend/ml_training 2000 --tune   # rasteriser + reversal grid
```

## Results

| | Original model | Fine-tuned model (shipped) |
|---|---|---|
| Scanned EMNIST letters, read correctly | 90.8% | 92.1% (95.4% with look-alikes) |
| Finger-drawn letters, read correctly (app settings) | 58.2% | **92.7%** |
| Right letters accepted, no false reversal | 82.1%¹ | **92.0%** |
| False reversal alarms on correctly written letters | 1.1% | 1.1% |
| Wrong letters accepted as the target | 0.7% | 0.4% |
| Mirrored letters caught (b↔d, backwards S, J…) | 40.8% | **86.5%** |
| Upside-down letters caught (b↔p, M↔W…) | 16.7% | **83.1%** |
| Half-turned letters caught (b↔q, d↔p…) | 51.3% | **64.2%** |

¹ Measured at the original model's own best rasteriser settings (blurred, 20 px), which flatter it. At the app's
settings it was lower still.

Reversal numbers for the original are at its previous thresholds (floor 0.35, margin 0.25). The fine-tuned
numbers are at the shipped ones (floor 0.25, margin 0.25), with the look-alike rule included.

### Why the original model fell short

- **Layout bug:** the original app fed upright canvas images to a model trained on EMNIST's transposed layout.
  LexiLeap transposes first.
- **Training data:** the model learnt only from scanned pen-on-paper letters. Finger-drawn letters look
  different (even width, thin, no blur), so it read only about 58% of them.
- **Reversals:** because it read so few finger-drawn letters well, it was rarely sure enough of a turned copy to
  call it a reversal.

### What changed

1. **Fine-tuning** (`scripts/finetune-handwriting.py`):
   - Training starts from the original weights and runs two more epochs on EMNIST *train*.
   - In each batch, 60% of the letters are redrawn as canvas strokes with a random pen width of 1.8–4 px; the
     rest stay as scanned.
   - The normal augmentation is kept.
   - The orientation and risk heads are distilled from the original model, so their meaning doesn't change.
   - The architecture, file size (416 KB) and speed are the same.
2. **Rasteriser:** the letter's longest side is 20 px in the 28 px image, not 24 px. This was the best setting on
   the grid for both models.
3. **Reversal thresholds:** a turned copy counts as the intended letter when the model gives it at least 25%,
   and at least 25 points more than the letter as written.
   - Lower margins catch a little more but double the false alarms (margin 0.15: 2.2%).
   - Telling a child they reversed a letter they wrote correctly is the more harmful mistake, so the margin
     stays at 0.25.
4. **Look-alike letters:** for these pairs the reading counts for either letter:
   - capital I and small l are the same straight line;
   - a small f is almost always read as capital F (0% before).

   Before this change, a child writing these correctly was marked wrong every time.

### Reversal threshold grid (fine-tuned model, before the look-alike rule)

| Floor | Margin | Right accepted | False alarms | Mirrored caught | Upside-down caught | Half-turn caught |
|---|---|---|---|---|---|---|
| 0.25 | 0.15 | 87.9% | 2.2% | 87.9% | 87.0% | 66.5% |
| **0.25** | **0.25** | **88.8%** | **1.1%** | **85.4%** | **82.8%** | **63.9%** |
| 0.25 | 0.35 | 89.1% | 0.6% | 80.7% | 75.7% | 60.1% |
| 0.35 | 0.25 | 88.8% | 1.1% | 83.5% | 81.0% | 62.2% |
| 0.45 | 0.25 | 88.8% | 1.1% | 80.5% | 77.9% | 59.7% |

## Weakest letters (shipped model, finger-drawn)

| Letter | Read correctly | Usual misreading |
|---|---|---|
| i | 47% (n=17) | l or I, when the dot is lost |
| j | 60% (n=10) | J |
| g / q | 62% (n=24 each) | each other |
| z | 79% | |
| k | 80% | |
| a | 81% | O |

The commonest confusions overall are e→C (11 of 2,000), i→l (6), q↔g (4 each way), j→J (4) and t→T (4).

## On the device

Measured on a Xiaomi Pad 6 (development build, Hermes):

- A letter is read in about 0.5 s.
- Up to about 2 s when the three turned copies are also checked. These checks are skipped when the letter is
  already clearly right.

## Limits

- **Simulated drawing:** these are EMNIST adults' letters redrawn as finger strokes, not children's own writing.
  Children's letters are often larger, shakier and built from separate strokes, so the real accuracy may be
  lower.
- **Collect real samples:** for the research study, re-measure with children's own letters, collected with
  consent and labelled by a grown-up. Today Write & Score logs each attempt's *result* (letter, reading,
  reversal, time), and the Write Test records an adult's corrections, but neither keeps the drawing itself.
  An opt-in, consented export of the strokes would be needed for that.
- **Not a diagnosis:** a reversal flag is a practice signal for the child and the adult, not a clinical finding.
  Reversals are common in all young writers up to about age 7.
