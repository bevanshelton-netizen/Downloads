# KORA KIDS Global Localisation Factory

Episode 1 Wave 1 currently contains 12 complete **machine-draft** language packs:

- Afrikaans
- isiZulu
- isiXhosa
- Sesotho
- Kiswahili
- French
- Portuguese
- Spanish
- Arabic
- Hindi
- Mandarin Chinese
- Bengali

These files are working translation drafts, not approved public translations.

## Hard release rule

A localisation cannot enter production dubbing until all six gates are approved:

1. Native-language review
2. Cultural-context review
3. Comic-timing review
4. Child-safety review
5. Fact-accuracy review
6. Final editorial review

The compiler supports two modes:

- `draft`: generates a timing script and WebVTT for review.
- `production`: refuses to run until every gate is approved and `approvedForDubbing` is true.

Lebo and Jabu remain brand names in every edition. Jabu's non-verbal elephant vocabulary is shared across languages and is therefore not duplicated in the translation packs.

Arabic is explicitly marked RTL. All other current Wave 1 packs are LTR.

## Example

```bash
node kora-kids-localisation/worker.mjs \
  --source kora-kids-localisation/source/jam-day-under-the-baobab.en-ZA.json \
  --pack kora-kids-localisation/packs/jam-day-under-the-baobab.fr.json \
  --output /tmp/kora-fr \
  --mode draft
```
