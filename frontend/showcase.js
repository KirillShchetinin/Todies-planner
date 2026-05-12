function loadShowcase() {
  const today = new Date();
  const dow = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const fmt = d => `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;

  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const ids    = [901, 902, 903, 904, 905, 906, 907];

  cols = labels.map((label, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return { id: ids[i], label, date: fmt(d) };
  });

  const nextMon = new Date(mon);
  nextMon.setDate(mon.getDate() + 7);
  cols.push({ id: 910, label: 'Mon', date: fmt(nextMon) });

  weekUnscheduled = [{ id: 900, label: 'Unscheduled' }, { id: 909, label: 'Unscheduled' }];

  typeConfig = {
    ...DEFAULT_TYPE_CONFIG,
    't-work':     { label: 'Work',     bg: '#e8f0fa', border: '#b5cff0', text: '#1a4a8a' },
    't-personal': { label: 'Personal', bg: '#eaf6ee', border: '#a8ddb8', text: '#1a5c30' },
    't-errand':   { label: 'Errand',   bg: '#fdf3dc', border: '#f5d98a', text: '#7a4800' },
  };

  legendOrder = ['Random', 't-work', 't-personal', 't-errand'];

  const [monId, tueId, wedId, thuId, friId, satId, sunId] = ids;

  state = {
    [monId]: [
      { id: 9001, text: 'Team standup',   type: 't-work' },
      { id: 9002, text: 'Walk the dog',   type: 't-personal' },
      { id: 9003, text: 'Buy groceries',  type: 't-errand' },
      { id: 9004, text: 'Morning run',    type: 't-personal', done: true },
    ],
    [tueId]: [
      { id: 9005, text: 'Team standup',        type: 't-work' },
      { id: 9006, text: 'Write weekly report',  type: 't-work' },
      { id: 9007, text: 'Walk the dog',         type: 't-personal' },
      { id: 9008, text: 'Take out trash',       type: 't-errand', done: true },
    ],
    [wedId]: [
      { id: 9009, text: 'Team standup',    type: 't-work' },
      { id: 9010, text: 'Call dentist',    type: 't-errand' },
      { id: 9011, text: 'Walk the dog',    type: 't-personal' },
      { id: 9012, text: 'Water the plants',type: 't-personal' },
    ],
    [thuId]: [
      { id: 9013, text: 'Team standup',     type: 't-work' },
      { id: 9014, text: 'Pay utility bills', type: 't-errand' },
      { id: 9015, text: 'Walk the dog',     type: 't-personal' },
      { id: 9016, text: 'Gym',              type: 't-personal' },
    ],
    [friId]: [
      { id: 9017, text: 'Team standup',  type: 't-work' },
      { id: 9018, text: 'Plan next week',type: 't-work' },
      { id: 9019, text: 'Walk the dog',  type: 't-personal' },
      { id: 9020, text: 'Pick up dry cleaning', type: 't-errand' },
    ],
    [satId]: [
      { id: 9021, text: 'Farmers market',  type: 't-errand' },
      { id: 9022, text: 'Walk the dog',    type: 't-personal' },
      { id: 9023, text: 'Clean the flat',  type: 't-personal' },
      { id: 9024, text: 'Read a book',     type: 't-personal' },
    ],
    [sunId]: [
      { id: 9025, text: 'Meal prep',    type: 't-personal' },
      { id: 9026, text: 'Walk the dog', type: 't-personal' },
      { id: 9027, text: 'Laundry',      type: 't-errand', done: true },
      { id: 9028, text: 'Call parents', type: 't-personal' },
    ],
    900: [
      { id: 9029, text: 'Fix bike',             type: 't-errand' },
      { id: 9030, text: 'Renew passport',        type: 't-errand' },
      { id: 9031, text: 'Book vet appointment',  type: 't-errand' },
    ],
    910: [
      { id: 9032, text: 'Team standup', type: 't-work' },
      { id: 9033, text: 'Walk the dog', type: 't-personal' },
    ],
  };

  applyScale(uiScale);
  applyLangToStaticUI();
  renderScaleBtns();
  render();
}
