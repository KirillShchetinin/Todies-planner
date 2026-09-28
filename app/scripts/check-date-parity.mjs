// check-date-parity.mjs — prove the app's copy of the date grammar still agrees
// with the backend's.
//
// A form's `date` is a display string, and three parsers now read it:
// backend/date_utils.py, frontend/common/dates.js, and the app's generated copy
// of that file. CLAUDE.md flags keeping the first two in sync as a standing
// hazard; this makes the agreement testable instead of aspirational.
//
//   node scripts/check-date-parity.mjs
//
// The contract compared is the one that matters at a write boundary:
//   1. both sides agree whether a string is an acceptable form date, and
//   2. when both accept it, both name the same calendar day.
// What a parser returns for a string it already rejected is not compared —
// JS rolls '13/01' over to 2027-01-01 while Python returns None, but both
// refuse to store it and parseDateToSortKey never rolls over, so nothing reads
// the difference.
//
// Sort keys and the ISO-week helpers are client-only; the Jest suite covers
// those.

import { execFileSync } from 'node:child_process';
import { parseColDate, isValidColDate, LEGACY_DATE_YEAR } from '../src/core/dates.js';

const CORPUS = [
  // plain MM/DD — the year must resolve to LEGACY_DATE_YEAR, not the clock's
  '1/1', '01/01', '12/31', '3/11', '03/11', '7/4', '07/04', '02/28',
  // explicit 4-digit year, including a real leap day
  '03/15/2024', '02/29/2024', '01/01/1999', '12/31/2100',
  // 2-digit year → +2000
  '03/15/24', '01/01/00', '12/31/99',
  // trailing marker is not part of the date
  '07/04+', '03/11/2026+', '1/1+',
  // impossible calendar days — must be rejected by both
  '2/29', '02/29/2023', '13/01', '00/01', '01/00', '07/45', '13/40',
  '02/30', '04/31', '11/31',
  // malformed
  '', 'Backlog', 'Unscheduled', '07/04++', '+07/04',
  '1/2/3/4', '01/2/02/02', '//', '1//2', 'a/b', '1/1/1', '1/1/12345',
  '-1/1', '1/-1', '1.5/2',
];

// Divergences that already exist between the two files. They are recorded here
// rather than silently tolerated: the check still fails if one MOVES, and
// anything not on this list is new drift. Neither is fixed here — both live in
// files this change does not touch.
const KNOWN_DIVERGENCES = {
  // dates.js:47 isValidColDate trims before matching, but matchColDate (and so
  // parseColDate) does not, and date_utils.py does not either. The client
  // therefore accepts ' 7/4' as a valid column date, POSTs it, and the backend
  // answers 400 — or, stored, it reads back as undated. dates.js's own comment
  // says whitespace is "NOT tolerated", and tests/test_dates.py asserts the
  // backend rejects it, so the trim in isValidColDate is the odd one out.
  ' 7/4': 'js isValidColDate trims, py does not',
  '7/4 ': 'js isValidColDate trims, py does not',
  // Python's re \d matches any Unicode decimal digit and int() accepts them, so
  // the backend reads '١/١' as 01/01; JS \d is ASCII-only and rejects it.
  '١/١': 'py \\d matches Unicode digits, js \\d is ASCII-only',
};

function pyResults(corpus) {
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(process.cwd() + '/..')})
from backend.date_utils import parse_form_date, is_valid_form_date
out = []
for s in json.load(sys.stdin):
    d = parse_form_date(s)
    out.append({"valid": is_valid_form_date(s), "date": d.isoformat() if d else None})
print(json.dumps(out))
`;
  return JSON.parse(execFileSync('python3', ['-c', script], {
    input: JSON.stringify(corpus), encoding: 'utf8',
  }));
}

const iso = (d) => d
  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  : null;

const all = [...CORPUS, ...Object.keys(KNOWN_DIVERGENCES)];
const py = pyResults(all);

const drift = [];
const healed = [];

all.forEach((s, i) => {
  const jsValid = isValidColDate(s);
  const { valid: pyValid, date: pyDate } = py[i];
  const known = Object.prototype.hasOwnProperty.call(KNOWN_DIVERGENCES, s);

  const agrees = jsValid === pyValid && (!jsValid || iso(parseColDate(s)) === pyDate);

  if (known && agrees) {
    healed.push(s);
  } else if (!known && !agrees) {
    drift.push({
      input: JSON.stringify(s),
      js: `valid=${jsValid} date=${iso(parseColDate(s))}`,
      py: `valid=${pyValid} date=${pyDate}`,
    });
  }
});

// The year-less anchor is the specific value that must not drift with the clock.
const anchorYear = parseColDate('06/15').getFullYear();
if (anchorYear !== LEGACY_DATE_YEAR) {
  drift.push({
    input: '"06/15"',
    js: `year=${anchorYear}`,
    py: `expected LEGACY_DATE_YEAR=${LEGACY_DATE_YEAR}`,
  });
}

if (drift.length) {
  console.error(`date grammar has DIVERGED — ${drift.length} new disagreement(s):\n`);
  for (const d of drift) console.error(`  ${d.input}\n    js: ${d.js}\n    py: ${d.py}`);
  console.error('\nbackend/date_utils.py and frontend/common/dates.js must agree.');
  process.exit(1);
}

console.log(`date grammar agrees: ${CORPUS.length} inputs, year-less anchor = ${LEGACY_DATE_YEAR}`);
if (healed.length) {
  console.log(`\n${healed.length} known divergence(s) now agree — remove from KNOWN_DIVERGENCES:`);
  for (const s of healed) console.log(`  ${JSON.stringify(s)}`);
  process.exit(1);
}
console.log(`${Object.keys(KNOWN_DIVERGENCES).length} known divergence(s) still present (see KNOWN_DIVERGENCES).`);
