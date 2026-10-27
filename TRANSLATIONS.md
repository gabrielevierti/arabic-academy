# Course translations

The English edition includes the course index, lesson titles, explanations,
tables, exercise instructions, choices, model answers and correction notes.
Arabic writing and diacritics are preserved exactly. Transliteration terms
are protected from the translation model. Lesson and exercise identifiers are
shared, so switching language does not create a separate progress record.
Personal notes, custom exercises and previously submitted answers are your
own data and are not automatically rewritten.

## Quality and provenance

The first full English edition was machine-translated locally using the
Helsinki-NLP OPUS-MT Italian-to-English model, with a CTranslate2 conversion
by Sams200 (revision `ddd82dd6b6754b9b32a7f60ede82057ef02c298c`).
Model authors: Language Technology Research Group, University of Helsinki.
Model licence: CC BY 4.0.

- Original model: https://huggingface.co/Helsinki-NLP/opus-mt-it-en
- CTranslate2 conversion: https://huggingface.co/Sams200/opus-mt-it-en
- Runtime: https://github.com/OpenNMT/CTranslate2

Translation runs during content preparation, not in the visitor's browser.
There are no translation API calls, keys, paid subscriptions or model downloads
required to study. Generated English files are committed as static JSON.
The model weights are not distributed with this website.

Automated checks validate structural parity, protected Arabic and stable IDs.
Selected samples have been reviewed; the entire course has not undergone human
linguistic review. Machine translation can mistranslate grammatical terminology,
fragments and explanations, so corrections with sources are welcome.

English input questions may also accept the original Italian answer. Arabic
answers, strict vowel checks and choice IDs are preserved. Instructions that
explicitly ask for a translation into/from Italian are adapted to English;
comparisons discussing Italian grammar retain their original reference.

## Files and contributions

- `public/course/*.json`: original Italian/Arabic edition.
- `public/course/en/*.json`: English/Arabic edition.
- `data/course.en.json`: English navigation index.
- `locales/en.json`: interface translations.
- `scripts/translation/overrides.json`: reviewed course translation overrides.
- `data/translation-report.json`: generation summary.

Report a correction with the lesson ID, exercise ID, existing wording, proposed
wording and a source or clear explanation. Editing a generated English JSON is
possible, but add the correction to the overrides too before regenerating.

To regenerate, install `ctranslate2` and `sentencepiece`, download the model's
config, weights, vocabulary and SentencePiece files to a local directory, and
provide `provenance.json` with its repository and revision. Then run:

```bash
python -m pip install -r scripts/translation/requirements.txt
python scripts/translation/translate_course.py --model /path/to/model --cache /path/to/translation-cache.json
npm test
npm run build
```

Do not commit model weights or private caches. Course material rights remain
separate from the model and code licences; see CONTENT-LICENSE.md.
