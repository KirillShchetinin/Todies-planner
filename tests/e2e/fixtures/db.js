// Seeds a fresh user straight into the e2e SQLite file.
//
// Going through the API instead would mean POST /api/account, which is rate
// limited to 3/min — and every test needs its own user, since a private user
// per test is what makes the suite safe to run fully parallel.

const path = require('path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const { METADATA, FORMS } = require('./seed-data');

const DB_FILE = process.env.TODIES_DB_PATH || path.join(__dirname, '..', '.tmp', 'e2e.db');

function withDb(fn) {
  const db = new DatabaseSync(DB_FILE);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    return fn(db);
  } finally {
    db.close();
  }
}

/**
 * Insert one user owning the canonical board.
 * Returns { token, formIds: {mon..sat, unscheduled}, taskIds: {'Task name': id} }.
 */
function seedBoard() {
  const token = randomUUID().replace(/-/g, '');

  return withDb(db => {
    const userId = db.prepare('INSERT INTO users (token, metadata) VALUES (?, ?)')
      .run(token, JSON.stringify(METADATA)).lastInsertRowid;

    const insForm = db.prepare(
      'INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order)' +
      ' VALUES (?, ?, ?, ?, ?, ?)');
    const insTask = db.prepare(
      'INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?)');

    const formIds = {};
    const taskIds = {};
    let order = 0;

    for (const [key, form] of Object.entries(FORMS)) {
      const formId = insForm.run(userId, key, form.label, form.date,
        form.unscheduled ? 1 : 0, order++).lastInsertRowid;
      formIds[key] = Number(formId);

      form.tasks.forEach(([name, type, done], i) => {
        const id = insTask.run(userId, formId, `${key}-${i}`, name, done, i,
          JSON.stringify({ type })).lastInsertRowid;
        taskIds[name] = Number(id);
      });
    }

    return { token, userId: Number(userId), formIds, taskIds };
  });
}

/** Rows straight from the DB — used to assert what actually persisted. */
function readTasks(userId) {
  return withDb(db => db.prepare(
    'SELECT id, form_id, name, done, sort_order, metadata FROM tasks' +
    ' WHERE user_id = ? ORDER BY form_id, sort_order').all(userId));
}

module.exports = { seedBoard, readTasks, DB_FILE };
