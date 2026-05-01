import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')

dst = sqlite3.connect('planner_db.db')
dst.row_factory = sqlite3.Row

print('Users:', dst.execute('SELECT COUNT(*) FROM users').fetchone()[0])
print('Forms:', dst.execute('SELECT COUNT(*) FROM forms').fetchone()[0])
print('Tasks:', dst.execute('SELECT COUNT(*) FROM tasks').fetchone()[0])
print()

rows = dst.execute('''
    SELECT f.client_id, f.label, f.date, f.is_unscheduled, COUNT(t.id) as task_count
    FROM forms f LEFT JOIN tasks t ON t.form_id = f.id
    GROUP BY f.id ORDER BY f.sort_order
''').fetchall()

for r in rows:
    kind  = 'unsched' if r['is_unscheduled'] else 'day'
    cid   = r['client_id']
    label = r['label']
    date  = r['date']
    tc    = r['task_count']
    print(f'  [{kind}] {cid:20s} {label:12s} {date:8s} tasks={tc}')

print()
print('Sample tasks:')
tasks = dst.execute('''
    SELECT t.client_id, t.name, t.done, t.metadata, f.client_id as form_cid
    FROM tasks t JOIN forms f ON t.form_id = f.id
    ORDER BY f.sort_order, t.sort_order
''').fetchall()
for t in tasks:
    print(f'  {t["form_cid"]:12s} | {t["client_id"]:6s} | done={t["done"]} | {t["name"]:35s} | meta={t["metadata"]}')

dst.close()
