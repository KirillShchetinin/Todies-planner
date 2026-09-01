# Todies iOS app

React Native + Expo rebuild of the mobile view. Talks to the same Flask backend
as the web app, over the same `?token=` auth.

Nothing under `frontend/` or `backend/` is modified by anything in here.

## The shared core

`src/core/` is **generated, not written**. The web frontend is classic scripts
sharing one global scope (`frontend/index.html`'s script order is its dependency
graph), which React Native cannot import. `scripts/sync-core.mjs` copies the
files from `frontend/common/` that are genuinely self-contained and appends an
`export { … }` footer built from their top-level declarations.

The reason to copy rather than reimplement is `dates.js`. A form's `date` is a
display string (`MM/DD` or `MM/DD/YYYY`, optional trailing `+`), and its grammar
already has to stay in lockstep with `backend/date_utils.py` by hand — CLAUDE.md
calls that out as a hazard. A third hand-maintained copy in Swift or TypeScript
would be a standing bug. This way there is one JS source of truth.

| Generated | Why it qualifies |
|---|---|
| `constants.js` | pure data |
| `dates.js` | pure; the date grammar |
| `collapse.js` | pure; a closure over its own state |
| `i18n.js` | pure except `applyLangToStaticUI`, which is **not exported** |

Everything else in `frontend/common/` reads globals another file declares, so it
cannot be copied as-is — run `npm run analyze-core` for the per-file breakdown.
`api.js`, `state.js`, `columns.js`, `tasks.js`, `types.js`, `undo.js`,
`settings.js` and `boot.js` get native reimplementations under `src/model/`,
which is where injected config and a React-friendly subscription replace
`window.location.search` and the direct `render()` calls.

Never edit `src/core/` by hand. Edit `frontend/common/` and re-run the sync.

## Commands

```bash
npm run sync-core      # regenerate src/core/ from frontend/common/
npm run check-core     # fail if src/core/ is stale (CI)
npm run analyze-core   # per-file free-variable report for frontend/common/
npm run check-dates    # run the real Python and the real JS over one corpus
npm test               # all of the above, plus the core unit tests
```

## Known divergences between the two date parsers

`npm run check-dates` runs `backend/date_utils.py` and `src/core/dates.js` over
one corpus and fails on any *new* disagreement. Three already exist and are
recorded in `KNOWN_DIVERGENCES` — the check fails if one of them silently
changes, in either direction. Both live in files outside this change's scope:

1. **Leading/trailing whitespace.** `dates.js:47` `isValidColDate` calls `.trim()`
   before matching, but `matchColDate` (and so `parseColDate`) does not, and
   neither does Python. So the client accepts `' 7/4'` as a valid column date and
   POSTs it, and the backend answers 400 — or, if stored, it reads back as
   undated. `dates.js`'s own comment says whitespace is "NOT tolerated" and
   `tests/test_dates.py::test_parse_rejects_surrounding_whitespace` asserts the
   backend rejects it, so the `trim()` in `isValidColDate` is the outlier.
2. **Unicode digits.** Python's `re` `\d` matches any Unicode decimal digit and
   `int()` accepts them, so the backend reads `'١/١'` as `01/01`. JS `\d` is
   ASCII-only and rejects it.
3. What each parser returns for a string *both* already reject is not compared —
   JS rolls `'13/01'` over to 2027-01-01 while Python returns `None`, but both
   refuse to store it and `parseDateToSortKey` never rolls over, so nothing reads
   the difference.
