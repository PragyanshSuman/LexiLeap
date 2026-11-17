"""
Builds assets/data/cmudict.txt, a compact pronunciation dictionary, from the original
app's CMU Pronouncing Dictionary JSON (cmu_dict_full.json, 10 MB).

Format: one entry per line, "word PH ON EMES": lower-case words of letters only, up to
14 letters, the first pronunciation of each word, stress digits removed. Loaded lazily on
device by services/pronunciationDictionary.ts.
The CMU Pronouncing Dictionary is BSD-licensed (Carnegie Mellon University).
Re-run with: python scripts/build-dictionary.py
"""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT.parent / "UnifiedLearningApp" / "src" / "features" / "phonics-phonemes" / "assets" / "data" / "cmu_dict_full.json"
OUT = ROOT / "assets" / "data" / "cmudict.txt"


def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    lines = []
    for word, phones in sorted(data.items()):
        if not re.fullmatch(r"[a-z]{1,14}", word):
            continue
        if isinstance(phones, list) and phones and isinstance(phones[0], list):
            phones = phones[0]
        if isinstance(phones, str):
            phones = phones.split()
        cleaned = [re.sub(r"\d", "", p) for p in phones]
        if cleaned:
            lines.append(f"{word} {' '.join(cleaned)}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(lines)} words, {OUT.stat().st_size // 1024} KB to {OUT}")


if __name__ == "__main__":
    main()
