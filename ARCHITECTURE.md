# Architecture

Arabic Academy remains React + strict TypeScript + Vite. The application has no
server, account system, paid API, tracking SDK or runtime translation service.
GitHub Pages serves immutable build assets and versioned educational JSON.

## Boundaries

- `app/page.tsx`: composition and legacy personal-content screens. This file is
  smaller in responsibility but is not yet fully decomposed.
- `app/course-index.tsx`: Italian course-index loading; the selected index
  is loaded independently of the shell.
- `app/navigation.tsx`, `lib/routing.ts`: six primary sections and hash routes.
- `app/native-course.tsx`: original reader and exercise UI, preserving IDs.
- `lib/grading.ts`: normalization, grading, recorded attempts and evidence.
- `lib/storage.ts`: IndexedDB schema, atomic transactions and compare-and-swap.
- `lib/use-progress-store.ts`: single React persistence owner, batching and tab
  invalidation. Components never write directly to IndexedDB.
- `lib/backup.ts`, `app/backup-manager.tsx`: validation, preview and atomic import.
- `lib/learning.ts`: mistake queues, SM-2-derived scheduling and planning metrics.
- `lib/session-planner.ts`, `lib/study-clock.ts`: pure planning/time policies.
- `app/micro-lessons.tsx`, `data/micro-lessons.json`: five explicit A0 pilot units.
- `app/alphabet.tsx`, `app/alphabet-assessment.tsx`, `app/handwriting.tsx`: basic
  letters, three recognition modes, limited form assessment and manual writing.
- `lib/vocabulary.ts`, reference/context components: source-table lookup; no
  inferred morphology. `scripts/build-study-indexes.mjs` generates level indexes.
- `lib/audio.ts`, `app/speaking-practice.tsx`: recording manifest, TTS fallback,
  local short-lived microphone recording; no automatic pronunciation grading.
- `scripts/build-offline.mjs`, `app/offline-status.tsx`: offline shell and update UI.

## Routes and deployment

Routes use `#/course`, `#/course/A0`, `#/lesson/A0-L0-01`, `#/alphabet`,
`#/micro`, `#/practice`, `#/review`, `#/progress`, `#/library`, `#/settings` and
`#/reference/<id>`. Hashes survive direct reload under `/arabic-academy/` without
server rewrites. Vite `base: './'` remains unchanged, including the historical
IndexedDB name. Browser back/forward resolves route state. Exercise retry drafts
are retained separately from checked answers. Scroll currently resets to the
content heading on navigation; per-route scroll restoration is not implemented.

## Content and caches

Original Italian and generated English documents are preserved. Only the Italian
index loads at startup. English course and study assets are removed from production builds. Major feature components use dynamic imports.
The in-memory course cache is bounded to 24 document promises; failed requests
are evicted. Search/vocabulary indexes load by level and language.

The production service worker precaches the shell, then caches opened assets and
lessons. It hashes public files at build time and validates network responses
against that release before caching them. A waiting update activates only when
the user chooses Save and update or all old clients close. Old release caches are
removed on activation. Progress and recordings never enter CacheStorage.
Cache eviction remains subject to browser quota and storage policies.

## Remaining architectural work

Legacy UI still contains `any` at content boundaries and inline translation
pairs. Full typed content decoding and a unified declarative renderer for every
requested activity type are unfinished. The existing four exercise modes remain
functional; new alphabet and assessment activities are separate components.
